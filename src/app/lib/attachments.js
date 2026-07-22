import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILES = 5;
const MAX_TEXT_FILE_SIZE = 1024 * 1024;
const MAX_PDF_FILE_SIZE = 5 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";
const ATTACHMENT_DEBUG = process.env.ASKLY_ATTACHMENT_DEBUG === "1";

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".env",
  ".sql",
  ".py",
  ".rb",
  ".php",
  ".java",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".vue",
  ".svelte",
]);

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/css",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/x-ndjson",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
]);

function validationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function attachmentLog(event, payload = {}) {
  if (!ATTACHMENT_DEBUG) return;
  console.info(`[askly:attachments] ${event}`, payload);
}

function extensionFor(filename) {
  const clean = filename.toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot);
}

function isAllowedTextFile(file, extension) {
  return TEXT_EXTENSIONS.has(extension) || TEXT_MIME_TYPES.has(file.type);
}

function isEncryptedPdfError(error) {
  return /password|encrypted|encryption|no password/i.test(error?.message || error?.name || "");
}

function isInvalidPdfError(error) {
  return /invalid pdf|missing pdf|corrupt|corrupted|formaterror|invalidpdf/i.test(
    error?.message || error?.name || ""
  );
}

function normalizeExtractedText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file) {
  attachmentLog("pdf:file", {
    name: file.name,
    type: file.type,
    size: file.size,
    runtime: "nodejs",
  });

  const arrayBuffer = await file.arrayBuffer();
  attachmentLog("pdf:array-buffer", {
    name: file.name,
    byteLength: arrayBuffer.byteLength,
  });

  const data = new Uint8Array(arrayBuffer);
  if (!data.byteLength) {
    throw validationError(`El archivo "${file.name}" está vacío.`);
  }

  const header = new TextDecoder("latin1").decode(data.slice(0, PDF_SIGNATURE.length));
  attachmentLog("pdf:header", {
    name: file.name,
    header,
    isPdf: header === PDF_SIGNATURE,
  });

  if (header !== PDF_SIGNATURE) {
    throw validationError("El archivo no parece ser un PDF válido.");
  }

  let pdf;

  try {
    attachmentLog("pdf:parser-start", { name: file.name });
    pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: true });
    const text = normalizeExtractedText(result.text);

    attachmentLog("pdf:parser-result", {
      name: file.name,
      totalPages: result.totalPages,
      textLength: text.length,
    });

    return text;
  } catch (error) {
    attachmentLog("pdf:parser-error", {
      name: file.name,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
    });

    if (error?.expose) throw error;
    if (isEncryptedPdfError(error)) {
      throw validationError("Este PDF está protegido con contraseña y no se puede leer.");
    }
    if (isInvalidPdfError(error)) {
      throw validationError("El archivo no parece ser un PDF válido.");
    }

    throw validationError("No se pudo procesar el PDF. Inténtalo con otro archivo.");
  } finally {
    await pdf?.destroy?.();
  }
}

async function extractTextFile(file) {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export function attachmentSummary(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

export async function extractAttachments(files) {
  const usableFiles = files.filter((file) => file && typeof file.name === "string");

  if (usableFiles.length > MAX_FILES) {
    throw validationError(`Puedes adjuntar hasta ${MAX_FILES} archivos por mensaje.`);
  }

  const extracted = [];

  for (const file of usableFiles) {
    const extension = extensionFor(file.name);
    const isPdf = extension === ".pdf" || file.type === "application/pdf";
    const maxSize = isPdf ? MAX_PDF_FILE_SIZE : MAX_TEXT_FILE_SIZE;

    if (!file.size) {
      throw validationError(`El archivo "${file.name}" está vacío.`);
    }

    if (file.size > maxSize) {
      const mb = Math.round(maxSize / 1024 / 1024);
      throw validationError(`"${file.name}" supera el límite de ${mb} MB.`, 413);
    }

    if (!isPdf && !isAllowedTextFile(file, extension)) {
      throw validationError(`"${file.name}" no es un tipo de archivo compatible.`);
    }

    let content = "";
    try {
      content = isPdf ? await extractPdfText(file) : await extractTextFile(file);
    } catch (err) {
      if (err?.expose) throw err;

      console.error("ATTACHMENT EXTRACTION ERROR:", {
        name: file.name,
        type: file.type,
        size: file.size,
        errorName: err?.name,
        message: err?.message,
        stack: ATTACHMENT_DEBUG ? err?.stack : undefined,
      });

      throw validationError(
        isPdf ? "No se pudo procesar el PDF. Inténtalo con otro archivo." : `No se pudo leer "${file.name}".`
      );
    }

    content = normalizeExtractedText(content);
    if (!content) {
      const message = isPdf
        ? "Este PDF no contiene texto seleccionable. La lectura mediante OCR todavía no está disponible."
        : `No se encontró texto legible en "${file.name}".`;
      throw validationError(message);
    }
    extracted.push({
      name: file.name,
      size: file.size,
      type: file.type,
      content,
    });
  }

  return extracted;
}

export function buildAttachmentContext(attachments) {
  if (!attachments.length) return "";

  return attachments
    .map(
      (file) => `Attached file: ${file.name}
---
${file.content}
---`
    )
    .join("\n\n");
}
