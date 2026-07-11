// app/login/page.jsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AuthCard from "@/app/components/AuthCard";
import AuthInput from "@/app/components/AuthInput";
import AuthButton from "@/app/components/AuthButton";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (!error) { router.push("/"); return; }
    setErrorMsg("Email o contraseña incorrectos.");
  };

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Bienvenida de nuevo a Askly."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-white underline underline-offset-2 hover:text-[var(--accent)]">
            Regístrate
          </Link>
        </>
      }
    >
      <AuthInput
        placeholder="Email" type="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
      />
      <AuthInput
        placeholder="Contraseña" type="password"
        value={password} onChange={(e) => setPassword(e.target.value)}
      />

      {errorMsg && <p className="px-2 text-sm text-red-400">{errorMsg}</p>}

      <AuthButton onClick={login} disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </AuthButton>
    </AuthCard>
  );
}
