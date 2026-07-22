"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

export default function PdfViewer({ attachment, onClose }) {
  const [viewer, setViewer] = useState({ loading: false, url: "", error: "" });

  useEffect(() => {
    let cancelled = false;

    async function loadSignedUrl() {
      if (!attachment?.id) return;
      setViewer({ loading: true, url: "", error: "" });

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Inicia sesión para ver este archivo.");

        const res = await fetch(`/api/attachments/${attachment.id}/signed-url`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "No se pudo abrir el PDF.");

        if (!cancelled) setViewer({ loading: false, url: json.url, error: "" });
      } catch (error) {
        if (!cancelled) {
          setViewer({
            loading: false,
            url: "",
            error: error.message || "No se pudo abrir el PDF.",
          });
        }
      }
    }

    loadSignedUrl();

    return () => {
      cancelled = true;
    };
  }, [attachment?.id]);

  if (!attachment) return null;

  return (
    <aside className="fixed inset-0 z-[70] flex flex-col border-l border-white/[0.06] bg-[var(--background)] text-[var(--foreground)] lg:left-auto lg:w-[420px]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-500/12 text-red-300">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{attachment.name}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-red-300">PDF</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {viewer.url && (
            <a
              href={viewer.url}
              download={attachment.name}
              className="grid size-8 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
              aria-label="Descargar PDF"
              title="Descargar PDF"
            >
              <Download className="size-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            aria-label="Cerrar visor"
            title="Cerrar visor"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {viewer.loading && (
          <div className="grid h-full place-items-center text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Cargando PDF...
            </span>
          </div>
        )}

        {viewer.error && (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--text-secondary)]">
            {viewer.error}
          </div>
        )}

        {viewer.url && (
          <iframe
            src={viewer.url}
            title={attachment.name}
            className="h-full w-full bg-white"
          />
        )}
      </div>
    </aside>
  );
}
