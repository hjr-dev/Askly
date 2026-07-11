"use client";

import { useEffect, useRef } from "react";
import Logo from "@/app/components/Logo";

export default function MessageList({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="mx-auto mb-6 w-full max-w-[800px] space-y-4 text-left">
      {messages.map((m, i) => {
        const isLastModelStreaming = loading && i === messages.length - 1 && m.role === "model";

        if (m.role === "user") {
          return (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]"
            >
              {m.content}
            </div>
          );
        }

        const isThinking = isLastModelStreaming && !m.content;

        return (
          <div key={i} className="flex max-w-[85%] items-start gap-2">
            <Logo size={20} animated={isThinking} className="mt-0.5 shrink-0" />
            <div className="flex-1 px-1 text-sm leading-7 text-[var(--foreground)]">
              {isThinking ? (
                <span className="text-[var(--text-secondary)]">Pensando…</span>
              ) : (
                <>
                  {m.content}
                  {isLastModelStreaming && (
                    <span className="motion-safe:animate-[askly-blink_1s_step-end_infinite]">▍</span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
