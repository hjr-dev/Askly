import { getUserFromAuthorization, findSubscriptionByUserId } from "@/app/lib/subscriptions";
import { getPlanFromSubscription } from "@/app/lib/plans";
import {
  createConversation,
  getConversationForUser,
  listConversationMessages,
  insertMessage,
  touchConversation,
  countTodayUserMessages,
  titleFromMessage,
} from "@/app/lib/conversations";
import { extractTextFromSSELine } from "@/app/lib/sse";

export const runtime = "nodejs";

export async function POST(req) {
  const { user, error } = await getUserFromAuthorization(req);
  if (error) return Response.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = (body?.message || "").trim();
  const conversationId = body?.conversationId || null;

  if (!message) {
    return Response.json({ error: "El mensaje está vacío" }, { status: 400 });
  }

  try {
    const subscription = await findSubscriptionByUserId(user.id);
    const plan = getPlanFromSubscription(subscription);

    if (plan.dailyMessageLimit !== Infinity) {
      const todayCount = await countTodayUserMessages(user.id);
      if (todayCount >= plan.dailyMessageLimit) {
        return Response.json(
          {
            error: `Has alcanzado el límite de ${plan.dailyMessageLimit} mensajes diarios del plan ${plan.label}. Mejora tu plan para seguir chateando hoy.`,
          },
          { status: 403 }
        );
      }
    }

    let conversation;
    if (conversationId) {
      conversation = await getConversationForUser(conversationId, user.id);
      if (!conversation) {
        return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
      }
    } else {
      conversation = await createConversation(user.id, titleFromMessage(message));
    }

    await insertMessage(conversation.id, "user", message);
    await touchConversation(conversation.id);

    const history = await listConversationMessages(conversation.id);
    const contents = history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${process.env.GEMINI_API_KEY}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: "Eres el asistente de Askly. Responde en español, claro y directo." }],
          },
        }),
      }
    );

    if (!geminiRes.ok || !geminiRes.body) {
      return Response.json({ error: "Error al conectar con Gemini" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    // El cliente necesita saber el id/título de la conversación en cuanto
    // arranca la respuesta (sobre todo cuando se crea desde la Home, sin
    // conversationId todavía) — se antepone como un chunk SSE especial que
    // useAskly.js reconoce antes de procesar los chunks normales de Gemini.
    const metaChunk = encoder.encode(
      `data: ${JSON.stringify({
        __meta__: true,
        conversationId: conversation.id,
        title: conversation.title,
      })}\n\n`
    );

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(metaChunk);

        const reader = geminiRes.body.getReader();
        let buffer = "";
        let fullText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            controller.enqueue(value);

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              const text = extractTextFromSSELine(line);
              if (text) fullText += text;
            }
          }
        } finally {
          controller.close();

          if (fullText.trim()) {
            try {
              await insertMessage(conversation.id, "model", fullText);
              await touchConversation(conversation.id);
            } catch (err) {
              console.error("No se pudo guardar la respuesta del modelo:", err);
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("CONVERSATIONS MESSAGES ERROR:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
