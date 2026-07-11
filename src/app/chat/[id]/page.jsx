"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import UpgradeButton from "@/app/components/MejorarButton";
import Composer from "@/app/components/Composer";
import MessageList from "@/app/components/MessageList";
import { supabase } from "@/app/lib/supabase";
import { useAskly } from "@/app/hooks/useAskly";

function ChatThread({ conversationId, initialMessages }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, loading } = useAskly({ conversationId, initialMessages });

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <main className="flex flex-1 flex-col justify-end px-5 py-8">
      <div className="mx-auto w-full max-w-[900px] flex-1 overflow-y-auto">
        <MessageList messages={messages} loading={loading} />
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
        .select("role, content")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      setConversation(conv);
      setInitialMessages(msgs || []);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

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
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 lg:pl-72">
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

      <div className="flex min-h-screen flex-col pt-16 lg:pl-72 lg:pt-0">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <h1 className="truncate text-sm font-medium text-[var(--foreground)]">{conversation?.title}</h1>
        </header>

        <ChatThread key={id} conversationId={id} initialMessages={initialMessages} />
      </div>
    </div>
  );
}
