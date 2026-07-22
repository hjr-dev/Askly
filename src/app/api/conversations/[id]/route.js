import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/app/lib/subscriptions";
import { deleteConversation, updateConversationTitle } from "@/app/lib/conversations";

const MAX_TITLE_LENGTH = 100;

export async function PATCH(request, context) {
  const { id } = await context.params;

  const { user, error } = await getUserFromAuthorization(request);
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";

  if (!title) {
    return NextResponse.json({ error: "El título no puede estar vacío" }, { status: 400 });
  }

  const conversation = await updateConversationTitle(id, user.id, title);

  return NextResponse.json({ conversation });
}

export async function DELETE(request, context) {
  const { id } = await context.params;

  const { user, error } = await getUserFromAuthorization(request);
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await deleteConversation(id, user.id);

  return NextResponse.json({ ok: true });
}
