"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { getPlanFromSubscription } from "@/app/lib/plans";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  // undefined = auth aún sin resolver; null = sin usuario; string = user id.
  // Con el sentinel `undefined`, `loading` no baja a false hasta saber si hay
  // sesión, y un usuario logueado no ve parpadear el plan "free" al cargar.
  const [userId, setUserId] = useState(undefined);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // El provider resuelve el usuario por sí mismo (no recibe prop `user`):
  // lee la sesión al montar y reacciona solo a login/logout.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (userId === undefined) return null;

    const { data } = await supabase.auth.getSession();

    if (!userId || !data.session) {
      setSubscription(null);
      setLoading(false);
      return null;
    }

    const res = await fetch("/api/subscription/status", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();
    const next = res.ok ? json.subscription || null : null;

    setSubscription(next);
    setLoading(false);
    return next;
  }, [userId]);

  useEffect(() => {
    // refresh() hace un return temprano o un await antes de tocar estado,
    // así que ningún setState corre de forma síncrona dentro de este efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Un único canal Realtime para toda la app (ya no hace falta instanceId):
  // escucha la fila que el webhook de Stripe escribe/actualiza en Supabase
  // para reflejar el nuevo plan al instante, sin polling ni reload.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`subscription-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Red de seguridad por si Realtime no está habilitado para la tabla o el
  // canal se cae: menos frecuente que antes (60s) y solo con la pestaña visible.
  useEffect(() => {
    if (!userId) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => clearInterval(poll);
  }, [userId, refresh]);

  const openBillingPortal = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("No hay sesión activa");

    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();

    if (!res.ok) throw new Error(json.error || "No se pudo abrir el portal de facturación");

    window.location.assign(json.url);
  }, []);

  const plan = getPlanFromSubscription(subscription);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        isPaid: plan.id !== "free",
        isPro: plan.id === "pro",
        isTeam: plan.id === "team",
        loading,
        refresh,
        openBillingPortal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription debe usarse dentro de <SubscriptionProvider>");
  }
  return ctx;
}