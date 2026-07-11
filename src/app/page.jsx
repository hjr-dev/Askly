"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PenLine, GraduationCap, Code2, UserRound } from "lucide-react";
import Footer from "@/app/components/Footer";
import Sidebar from "@/app/components/Sidebar";
import UpgradeButton from "@/app/components/MejorarButton";
import Composer from "@/app/components/Composer";
import MessageList from "@/app/components/MessageList";
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

  const handleSubmit = () => {
    if (!input.trim() || loading || isGuest) return;
    sendMessage(input);
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
      <UpgradeButton />

      <div className="flex min-h-screen flex-col pt-16 lg:pl-72 lg:pt-0">
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-24">
          <section className="mx-auto w-full max-w-[900px] text-center">
            {messages.length === 0 && (
              <div className="mb-10">
                <h1 className="flex items-center justify-center gap-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--foreground)] sm:text-[44px]">
                  <Logo size={34} />
                  {greeting(displayName)}
                </h1>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">¿En qué trabajamos hoy?</p>
              </div>
            )}

            {messages.length > 0 && <MessageList messages={messages} loading={loading} />}

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
            />

            {messages.length === 0 && !isGuest && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setInput(c.prompt)}
                    className="flex items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:border-[var(--accent)]/60 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    <c.icon className="size-4 text-[var(--accent)]" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

        <Footer />
      </div>
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
