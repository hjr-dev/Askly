"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { parseSSELine, sanitizeThinkTags } from "@/app/lib/sse";

export function useAskly({ conversationId: initialConversationId = null, initialMessages = [] } = {}) {
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [title, setTitle] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (text, attachments = []) => {
      const trimmedText = text.trim();
      if (!trimmedText && attachments.length === 0) return;

      const userMsg = {
        role: "user",
        content: trimmedText,
        attachments: attachments.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
          status: "uploading",
        })),
      };
      setMessages((prev) => [...prev, userMsg, { role: "model", content: "" }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const fail = (errorText) => {
        setMessages((prev) => {
          const updated = [...prev];
          const userIndex = updated.length - 2;
          if (userIndex >= 0 && updated[userIndex]?.attachments?.length) {
            updated[userIndex] = {
              ...updated[userIndex],
              attachments: updated[userIndex].attachments.map((attachment) => ({
                ...attachment,
                status: attachment.id ? attachment.status || "ready" : "error",
                error: attachment.id ? attachment.error : errorText,
              })),
            };
          }
          updated[updated.length - 1].content = sanitizeThinkTags(errorText);
          return updated;
        });
      };

      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          fail("Inicia sesión para chatear con Askly.");
          return;
        }

        const requestBody =
          attachments.length > 0
            ? (() => {
                const formData = new FormData();
                formData.append("message", trimmedText);
                if (conversationId) formData.append("conversationId", conversationId);
                for (const file of attachments) formData.append("files", file);
                return formData;
              })()
            : JSON.stringify({ conversationId, message: trimmedText });

        const headers = {
          Authorization: `Bearer ${data.session.access_token}`,
        };

        if (!attachments.length) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch("/api/conversations/messages", {
          method: "POST",
          headers,
          body: requestBody,
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          fail(json.error || "Ha ocurrido un error al contactar con Askly. Inténtalo de nuevo.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const parsed = parseSSELine(line);
            if (!parsed) continue;

            if (parsed.__meta__) {
              setConversationId(parsed.conversationId);
              setTitle(parsed.title);
              if (parsed.attachments?.length) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const userIndex = updated.length - 2;
                  const modelIndex = updated.length - 1;

                  if (userIndex >= 0 && updated[userIndex]?.role === "user") {
                    updated[userIndex] = {
                      ...updated[userIndex],
                      id: parsed.userMessageId || updated[userIndex].id,
                      attachments: parsed.attachments,
                    };
                  }

                  if (modelIndex >= 0 && updated[modelIndex]?.role === "model") {
                    updated[modelIndex] = {
                      ...updated[modelIndex],
                      sources: parsed.attachments,
                    };
                  }

                  return updated;
                });
              }
              continue;
            }

            if (parsed.error) {
              fail(parsed.error);
              continue;
            }

            const chunk = sanitizeThinkTags(parsed.content || "");
            if (chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].content += chunk;
                return updated;
              });
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  return { messages, sendMessage, loading, conversationId, title };
}
