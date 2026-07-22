"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import UpgradeButton from "@/app/components/MejorarButton";
import Composer from "@/app/components/Composer";
import MessageList from "@/app/components/MessageList";
import PdfViewer from "@/app/components/PdfViewer";
import { supabase } from "@/app/lib/supabase";
import { useAskly } from "@/app/hooks/useAskly";
import { legacyConversationTitle } from "@/app/lib/conversationTitles";

function ChatThread({ conversationId, initialMessages, onOpenAttachment }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, loading } = useAskly({ conversationId, initialMessages });

  const handleSubmit = (attachments = []) => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    sendMessage(input, attachments);
    setInput("");
  };

  return (
    <main className="flex flex-1 flex-col justify-end px-0 py-8 sm:px-5">
      <div className="mx-auto w-full max-w-[900px] flex-1 overflow-y-auto px-4 sm:px-0">
        <MessageList
          messages={messages}
          loading={loading}
          onOpenAttachment={onOpenAttachment}
        />
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={loading}
        placeholder="¿En qué puedo ayudarte hoy?"
      />
    </main>
  );
}

export default function ChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [conversation, setConversation] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [openAttachment, setOpenAttachment] = useState(null);
  const [lastId, setLastId] = useState(id);

  // Al navegar entre conversaciones (mismo componente, id distinto) hay que
  // volver a mostrar el loader — patrón "adjust state during render", igual
  // que usa Sidebar.jsx para el pathname.
  if (id !== lastId) {
    setLastId(id);
    setStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data: conv } = await supabase
        .from("conversations")
        .select("id, title")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (!conv) {
        setStatus("not-found");
        return;
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      const { data: attachmentRows, error: attachmentError } = await supabase
        .from("message_attachments")
        .select(
          "id, user_message_id, model_message_id, original_filename, mime_type, file_size, processing_status, error_message"
        )
        .eq("conversation_id", id);

      if (cancelled) return;

      if (attachmentError) {
        console.warn("No se pudieron cargar los adjuntos:", attachmentError.message);
      }

      const attachmentsByUserMessage = new Map();
      const sourcesByModelMessage = new Map();

      for (const row of attachmentRows || []) {
        const attachment = {
          id: row.id,
          name: row.original_filename,
          type: row.mime_type,
          size: row.file_size,
          status: row.processing_status,
          error: row.error_message,
        };

        if (!attachmentsByUserMessage.has(row.user_message_id)) {
          attachmentsByUserMessage.set(row.user_message_id, []);
        }
        attachmentsByUserMessage.get(row.user_message_id).push(attachment);

        if (row.model_message_id) {
          if (!sourcesByModelMessage.has(row.model_message_id)) {
            sourcesByModelMessage.set(row.model_message_id, []);
          }
          sourcesByModelMessage.get(row.model_message_id).push(attachment);
        }
      }

      const hydratedMessages = (msgs || []).map((message) => ({
        ...message,
        attachments: attachmentsByUserMessage.get(message.id) || [],
        sources: sourcesByModelMessage.get(message.id) || [],
      }));

      const firstUserMessage = hydratedMessages.find((message) => message.role === "user");
      setConversation({
        ...conv,
        title: conv.title?.trim() || legacyConversationTitle(firstUserMessage?.content),
      });
      setInitialMessages(hydratedMessages);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    const onRenamed = (event) => {
      if (event.detail?.id !== id) return;
      setConversation((current) =>
        current ? { ...current, title: event.detail.title } : current
      );
    };

    window.addEventListener("askly:conversation-renamed", onRenamed);
    return () => window.removeEventListener("askly:conversation-renamed", onRenamed);
  }, [id]);

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[var(--text-secondary)]">
        Cargando conversación...
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Sidebar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 lg:pl-[var(--sidebar-w)]">
          <p className="text-sm text-[var(--text-secondary)]">Conversación no encontrada.</p>
          <Link href="/" className="text-sm font-medium text-[var(--accent)] hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar />
      <UpgradeButton />

      <div
        className={`flex min-h-screen flex-col pt-16 transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] lg:pt-0 ${
          openAttachment ? "lg:pr-[420px]" : ""
        }`}
      >
        <header className="border-b border-[var(--border)] px-6 py-4">
          <h1 className="truncate text-sm font-medium text-[var(--foreground)]">{conversation?.title}</h1>
        </header>

        <ChatThread
          key={id}
          conversationId={id}
          initialMessages={initialMessages}
          onOpenAttachment={setOpenAttachment}
        />
      </div>

      <PdfViewer attachment={openAttachment} onClose={() => setOpenAttachment(null)} />
    </div>
  );
}
