import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const ATTACHMENT_BUCKET = "message-attachments";
const MISSING_ATTACHMENTS_HINT =
  "Falta aplicar supabase/attachments.sql para crear la tabla message_attachments y el bucket privado de adjuntos.";

function exposedError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function isMissingAttachmentInfrastructure(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    /message_attachments|Could not find the table|schema cache|bucket/i.test(
      error?.message || error?.error || ""
    )
  );
}

function storageExtension(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

async function ensureAttachmentBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(ATTACHMENT_BUCKET);
  if (data && !error) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(ATTACHMENT_BUCKET, {
    public: false,
  });

  if (createError && !/already exists/i.test(createError.message || "")) {
    throw createError;
  }
}

function toClientAttachment(row) {
  return {
    id: row.id,
    name: row.original_filename,
    type: row.mime_type,
    size: row.file_size,
    status: row.processing_status,
    error: row.error_message,
  };
}

export function toClientAttachments(rows = []) {
  return rows.map(toClientAttachment);
}

export async function storeMessageAttachments({
  files,
  extractedAttachments,
  userId,
  conversationId,
  userMessageId,
}) {
  if (!files.length) return [];

  const rows = [];
  await ensureAttachmentBucket().catch((error) => {
    console.error("ATTACHMENT BUCKET ERROR:", {
      status: error?.status || error?.statusCode,
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
    throw exposedError("No se pudo guardar el archivo adjunto. Revisa la configuración de almacenamiento.");
  });

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extracted = extractedAttachments[index];
    const extension = storageExtension(file.name);
    const storagePath = `${userId}/${conversationId}/${userMessageId}/${randomUUID()}${extension}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || extracted?.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("ATTACHMENT UPLOAD ERROR:", {
        status: uploadError?.status || uploadError?.statusCode,
        name: uploadError?.name,
        code: uploadError?.code,
        message: uploadError?.message,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
      throw exposedError("No se pudo subir el PDF. Inténtalo de nuevo.");
    }

    rows.push({
      conversation_id: conversationId,
      user_message_id: userMessageId,
      user_id: userId,
      original_filename: file.name,
      mime_type: file.type || extracted?.type || "application/octet-stream",
      file_size: file.size,
      storage_bucket: ATTACHMENT_BUCKET,
      storage_path: storagePath,
      processing_status: "ready",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("message_attachments")
    .insert(rows)
    .select(
      "id, original_filename, mime_type, file_size, processing_status, error_message"
    );

  if (error) {
    console.error("ATTACHMENT DB ERROR:", {
      status: error?.status || error?.statusCode,
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
    if (isMissingAttachmentInfrastructure(error)) {
      throw exposedError(MISSING_ATTACHMENTS_HINT);
    }
    throw exposedError("No se pudo guardar la información del archivo adjunto.");
  }
  return data || [];
}

export async function linkAttachmentsToModelMessage({ userMessageId, modelMessageId }) {
  const { error } = await supabaseAdmin
    .from("message_attachments")
    .update({ model_message_id: modelMessageId })
    .eq("user_message_id", userMessageId);

  if (error) throw error;
}

export async function listAttachmentsForConversation(conversationId, userId) {
  const { data, error } = await supabaseAdmin
    .from("message_attachments")
    .select(
      "id, user_message_id, model_message_id, original_filename, mime_type, file_size, processing_status, error_message"
    )
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAttachmentForUser(attachmentId, userId) {
  const { data, error } = await supabaseAdmin
    .from("message_attachments")
    .select("id, original_filename, mime_type, file_size, storage_bucket, storage_path")
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createAttachmentSignedUrl(attachment, expiresIn = 60 * 5) {
  const { data, error } = await supabaseAdmin.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, expiresIn, {
      download: false,
    });

  if (error) throw error;
  return data.signedUrl;
}
