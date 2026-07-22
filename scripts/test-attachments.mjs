import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAttachmentContext,
  extractAttachments,
} from "../src/app/lib/attachments.js";

const defaultPdfPath = "/Users/hajarlakchouch/Downloads/SRD.pdf";
const pdfPath = process.argv[2] || defaultPdfPath;
const expectedPhrase = process.argv[3] || "Askly SaaS Platform";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeFile(bytes, name, type) {
  return new File([bytes], name, { type });
}

async function testPdf() {
  assert(existsSync(pdfPath), `No se encontró el PDF de prueba: ${pdfPath}`);

  const bytes = await readFile(pdfPath);
  const header = bytes.subarray(0, 5).toString("latin1");

  assert(bytes.byteLength > 0, "El PDF llegó con 0 bytes.");
  assert(header === "%PDF-", `La cabecera no parece PDF: ${header}`);

  const pdfFile = makeFile(bytes, path.basename(pdfPath), "application/pdf");
  const formData = new FormData();
  formData.append("message", "Resume el documento adjunto.");
  formData.append("files", pdfFile);

  const request = new Request("http://localhost/api/conversations/messages", {
    method: "POST",
    body: formData,
  });

  const parsedFormData = await request.formData();
  const uploadedFiles = parsedFormData
    .getAll("files")
    .filter((file) => file && typeof file !== "string");

  assert(uploadedFiles.length === 1, "El FormData no conserva el archivo PDF.");
  assert(uploadedFiles[0].size === bytes.byteLength, "El tamaño del PDF cambió en FormData.");

  const [pdf] = await extractAttachments(uploadedFiles);

  assert(pdf.content.length > 0, "La extracción del PDF devolvió texto vacío.");
  assert(
    pdf.content.includes(expectedPhrase),
    `El texto extraído no contiene la frase esperada: ${expectedPhrase}`
  );

  const promptContext = buildAttachmentContext([pdf]);
  assert(
    promptContext.includes(expectedPhrase),
    "El texto extraído no llegó al contexto que se envía al LLM."
  );

  return {
    name: pdf.name,
    bytes: bytes.byteLength,
    formDataFileCount: uploadedFiles.length,
    characters: pdf.content.length,
    containsExpectedPhrase: true,
    reachesPromptContext: true,
  };
}

async function testTextAndMarkdown() {
  const txtFile = makeFile("Askly TXT attachment check", "sample.txt", "text/plain");
  const mdFile = makeFile("# Askly Markdown\n\nAttachment check.", "sample.md", "text/markdown");
  const extracted = await extractAttachments([txtFile, mdFile]);
  const context = buildAttachmentContext(extracted);

  assert(context.includes("Askly TXT attachment check"), "El TXT no llegó al contexto.");
  assert(context.includes("Askly Markdown"), "El Markdown no llegó al contexto.");

  return {
    textFiles: extracted.length,
    textAndMarkdownReachPromptContext: true,
  };
}

try {
  const pdf = await testPdf();
  const text = await testTextAndMarkdown();

  console.log(
    JSON.stringify(
      {
        ok: true,
        pdf,
        text,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
