// app/register/page.jsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { supabase } from "@/app/lib/supabase";
import AuthCard from "@/app/components/AuthCard";
import AuthInput from "@/app/components/AuthInput";
import AuthButton from "@/app/components/AuthButton";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const register = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Email y contraseña obligatorios.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, phone, country: countryName, country_code: countryCode } },
    });

    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    setSuccessMsg("Revisa tu email para confirmar la cuenta.");
    router.push("/login");
  };

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Empieza a usar Askly gratis."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-white underline underline-offset-2 hover:text-[var(--accent)]">
            Inicia sesión
          </Link>
        </>
      }
    >
      <AuthInput placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
      <AuthInput
        placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
      />
      <AuthInput
        placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
      />
      <AuthInput
        placeholder="Confirmar contraseña" type="password" value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <div className="phone-dark">
        <PhoneInput
          country={countryCode || "es"}
          value={phone}
          onChange={(value, data) => { setPhone(value); setCountryName(data.name); setCountryCode(data.countryCode); }}
        />
      </div>

      {errorMsg && <p className="px-2 text-sm text-red-400">{errorMsg}</p>}
      {successMsg && <p className="px-2 text-sm text-[var(--accent)]">{successMsg}</p>}

      <AuthButton onClick={register} disabled={loading}>
        {loading ? "Creando..." : "Crear cuenta"}
      </AuthButton>
    </AuthCard>
  );
}
