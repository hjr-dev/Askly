"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";

export function useAskly({ conversationId: initialConversationId = null, initialMessages = [] } = {}) {
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [title, setTitle] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim()) return;
      const userMsg = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg, { role: "model", content: "" }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const fail = (errorText) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = errorText;
          return updated;
        });
      };

      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          fail("Inicia sesión para chatear con Askly.");
          return;
        }

        const res = await fetch("/api/conversations/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ conversationId, message: text }),
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
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            try {
              const parsed = JSON.parse(json);
              if (parsed.__meta__) {
                setConversationId(parsed.conversationId);
                setTitle(parsed.title);
                continue;
              }
              const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].content += chunk;
                return updated;
              });
            } catch {}
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
