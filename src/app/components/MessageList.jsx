"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import Logo from "@/app/components/Logo";

function attachmentStatusLabel(status) {
  if (status === "uploading") return "Subiendo";
  if (status === "processing") return "Procesando";
  if (status === "error") return "Error";
  return "Listo";
}

function PdfAttachmentCard({ attachment, compact = false, onOpenAttachment }) {
  const canOpen = attachment.id && attachment.status !== "error";
  const isPending = attachment.status === "uploading" || attachment.status === "processing";
  const isError = attachment.status === "error";
  const isPdf =
    attachment.type === "application/pdf" || attachment.name?.toLowerCase().endsWith(".pdf");
  const label = isPdf ? "PDF" : "Archivo";

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={() => canOpen && onOpenAttachment?.(attachment)}
      className={`group flex max-w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] text-left transition-colors hover:bg-white/[0.055] disabled:cursor-default disabled:hover:bg-white/[0.035] ${
        compact ? "px-2.5 py-2" : "w-full px-3 py-2.5 sm:w-[320px]"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg ${
          isPdf ? "bg-red-500/14 text-red-300" : "bg-white/[0.06] text-[var(--text-secondary)]"
        }`}
      >
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--foreground)]">
          {attachment.name}
        </span>
        <span
          className={`mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] ${
            isPdf ? "text-red-300" : "text-[var(--text-secondary)]"
          }`}
        >
          {label}
          <span className="normal-case tracking-normal text-[var(--text-secondary)]">
            {attachmentStatusLabel(attachment.status)}
          </span>
          {isPending && <Loader2 className="size-3 animate-spin text-[var(--text-secondary)]" />}
          {isError && <AlertCircle className="size-3 text-red-300" />}
        </span>
      </span>
    </button>
  );
}

export default function MessageList({ messages, loading, onOpenAttachment }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="mx-auto mb-6 w-full max-w-[880px] space-y-4 text-left">
      {messages.map((m, i) => {
        const isLastModelStreaming = loading && i === messages.length - 1 && m.role === "model";

        if (m.role === "user") {
          return (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]"
            >
              {m.attachments?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {m.attachments.map((file) => (
                    <PdfAttachmentCard
                      key={file.id || `${file.name}-${file.size}`}
                      attachment={file}
                      onOpenAttachment={onOpenAttachment}
                    />
                  ))}
                </div>
              )}
              {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
            </div>
          );
        }

        const isThinking = isLastModelStreaming && !m.content;

        return (
          <div key={i} className="flex w-full max-w-[880px] items-start gap-2">
            <Logo size={20} animated={isThinking} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 px-1 text-sm leading-7 text-[var(--foreground)]">
              {isThinking ? (
                <span className="text-[var(--text-secondary)]">Pensando…</span>
              ) : (
                <div className="askly-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  {isLastModelStreaming && (
                    <span className="motion-safe:animate-[askly-blink_1s_step-end_infinite]">▍</span>
                  )}
                </div>
              )}
              {m.sources?.length > 0 && !isThinking && (
                <div className="mt-5 border-t border-white/[0.06] pt-3">
                  <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {m.sources.map((source) => (
                      <PdfAttachmentCard
                        key={source.id || `${source.name}-${source.size}`}
                        attachment={source}
                        compact
                        onOpenAttachment={onOpenAttachment}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
