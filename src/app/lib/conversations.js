import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const MISSING_TABLE_HINT =
  "Falta la tabla public.conversations/messages en Supabase. Ejecuta supabase/conversations.sql en el SQL Editor.";

function isMissingTable(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("public.conversations") ||
    error?.message?.includes("public.messages") ||
    error?.message?.includes("Could not find the table")
  );
}

export function titleFromMessage(message) {
  const words = message.trim().split(/\s+/).slice(0, 6);
  const title = words.join(" ");
  return title.length < message.trim().length ? `${title}…` : title || "Nueva conversación";
}

export async function createConversation(userId, title) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
  return data;
}

export async function getConversationForUser(conversationId, userId) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
  return data;
}

export async function listConversationMessages(conversationId) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
  return data || [];
}

export async function insertMessage(conversationId, role, content) {
  const { error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, role, content });

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
}

export async function touchConversation(conversationId) {
  const { error } = await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
}

export async function deleteConversation(conversationId, userId) {
  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
}

export async function countTodayUserMessages(userId) {
  const startOfDayUTC = new Date();
  startOfDayUTC.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("messages")
    .select("id, conversations!inner(user_id)", { count: "exact", head: true })
    .eq("role", "user")
    .eq("conversations.user_id", userId)
    .gte("created_at", startOfDayUTC.toISOString());

  if (isMissingTable(error)) throw new Error(MISSING_TABLE_HINT);
  if (error) throw error;
  return count || 0;
}