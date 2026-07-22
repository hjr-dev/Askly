import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/app/lib/subscriptions";
import {
  createAttachmentSignedUrl,
  getAttachmentForUser,
} from "@/app/lib/messageAttachments";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { user, error } = await getUserFromAuthorization(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  const attachment = await getAttachmentForUser(id, user.id);

  if (!attachment) {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }

  const url = await createAttachmentSignedUrl(attachment);

  return NextResponse.json({
    url,
    filename: attachment.original_filename,
    type: attachment.mime_type,
    size: attachment.file_size,
  });
}
