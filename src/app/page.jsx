"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PenLine, GraduationCap, Code2, UserRound } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import UpgradeButton from "@/app/components/MejorarButton";
import Composer from "@/app/components/Composer";
import MessageList from "@/app/components/MessageList";
import PdfViewer from "@/app/components/PdfViewer";
import Logo from "@/app/components/Logo";
import { supabase } from "@/app/lib/supabase";
import { useAskly } from "@/app/hooks/useAskly";

const chips = [
  { label: "Escribir", icon: PenLine, prompt: "Ayúdame a escribir " },
  { label: "Aprender", icon: GraduationCap, prompt: "Ayúdame a entender " },
  { label: "Código", icon: Code2, prompt: "Ayúdame con este código: " },
  { label: "Asuntos personales", icon: UserRound, prompt: "" },
];

function greeting(name) {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  return name ? `${timeGreeting}, ${name}` : timeGreeting;
}

function AppPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [input, setInput] = useState(() => searchParams.get("prompt") || "");
  const [pendingNav, setPendingNav] = useState(false);
  const [openAttachment, setOpenAttachment] = useState(null);
  const { messages, sendMessage, loading, conversationId } = useAskly();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setCheckingSession(false);
    });
  }, []);

  // Responde el primer mensaje aquí mismo (streaming) y solo navega a
  // /chat/[id] cuando la respuesta ha terminado, para no cortar el stream
  // a mitad de una navegación cliente.
  useEffect(() => {
    if (pendingNav && !loading && conversationId) {
      router.push(`/chat/${conversationId}`);
    }
  }, [pendingNav, loading, conversationId, router]);

  const isGuest = !user;
  const displayName = user?.user_metadata?.full_name?.trim()?.split(" ")[0] || null;

  const handleSubmit = (attachments = []) => {
    if ((!input.trim() && attachments.length === 0) || loading || isGuest) return;
    sendMessage(input, attachments);
    setInput("");
    setPendingNav(true);
  };

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[var(--text-secondary)]">
        Cargando Askly...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar />
      <UpgradeButton hideOnMobile />

      <div
        className={`flex min-h-screen flex-col pt-16 transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] lg:pt-0 ${
          openAttachment ? "lg:pr-[420px]" : ""
        }`}
      >
        <main className="flex min-h-[calc(100svh-64px)] flex-1 flex-col items-center justify-center px-0 py-20 sm:min-h-[calc(100vh-120px)] sm:px-5 sm:py-24">
          <section className="mx-auto w-full max-w-[900px] text-center">
            {messages.length === 0 && (
              <div className="mb-9 px-4 sm:mb-10">
                <h1 className="flex items-center justify-center gap-2 font-[family-name:var(--font-display)] text-[32px] font-light leading-none tracking-[-0.035em] text-[#dedbd5] min-[390px]:text-[34px] sm:gap-2.5 sm:text-[40px]">
                  <Logo size={22} className="translate-y-[1px] opacity-90 sm:hidden" />
                  <Logo size={28} className="hidden translate-y-[1px] opacity-85 sm:block" />
                  {greeting(displayName)}
                </h1>
              </div>
            )}

            {messages.length > 0 && (
              <MessageList
                messages={messages}
                loading={loading}
                onOpenAttachment={setOpenAttachment}
              />
            )}

            {isGuest && (
              <div className="mx-auto mb-4 max-w-[520px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
                  Inicia sesión
                </Link>{" "}
                para empezar a chatear con Askly.
              </div>
            )}

            <Composer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={loading || isGuest}
              placeholder={isGuest ? "Inicia sesión para continuar" : "¿En qué puedo ayudarte hoy?"}
              spacious={messages.length === 0}
              maxWidthClass="sm:w-[min(100%,760px)]"
            />

            {messages.length === 0 && !isGuest && (
              <div className="mx-auto mt-6 flex w-[calc(100vw-32px)] max-w-[720px] flex-wrap justify-center gap-x-2.5 gap-y-2.5 pb-32 sm:mt-7 sm:gap-x-3 sm:gap-y-3 sm:pb-0">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setInput(c.prompt)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.04] bg-transparent px-3 py-1 text-[11px] text-[var(--text-secondary)] transition-colors duration-200 hover:border-white/[0.08] hover:bg-white/[0.025] hover:text-[var(--foreground)] sm:px-3.5 sm:py-1.5 sm:text-xs"
                  >
                    <c.icon className="size-3 text-[var(--accent)]/75 sm:size-3.5" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

      </div>
      <PdfViewer attachment={openAttachment} onClose={() => setOpenAttachment(null)} />
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--text-secondary)]">
          Cargando...
        </main>
      }
    >
      <AppPageContent />
    </Suspense>
  );
}
