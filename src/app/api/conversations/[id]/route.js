import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/app/lib/subscriptions";
import { deleteConversation } from "@/app/lib/conversations";

export async function DELETE(request, context) {
  const { id } = await context.params;

  const { user, error } = await getUserFromAuthorization(request);
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await deleteConversation(id, user.id);

  return NextResponse.json({ ok: true });
}