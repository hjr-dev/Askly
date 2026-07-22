"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import MejorarButton from "@/app/components/MejorarButton";
import { supabase } from "@/app/lib/supabase";
import { useSubscription } from "@/app/hooks/useSubscription";
import { PLANS } from "@/app/lib/plans";

const CURRENCY_SYMBOLS = { eur: "€", usd: "$", gbp: "£" };
const PRICING_CARD_LABELS = {
  free: "Gratis",
  pro: "Pro",
  team: "Equipos",
};

const DEFAULT_PRICING_CTAS = {
  pro: "Pasar a Pro",
  team: "Elegir Equipos",
};

function formatPrice(price) {
  if (!price) return null;
  const symbol = CURRENCY_SYMBOLS[price.currency] || price.currency.toUpperCase() + " ";
  return `${(price.amount / 100).toFixed(0)} ${symbol}`;
}

function PricingBackButton() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Volver"
      className="fixed left-4 top-4 z-30 grid size-8 place-items-center rounded-full bg-transparent text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.03] hover:text-[var(--foreground)]"
    >
      <ChevronLeft className="size-4" />
    </button>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [prices, setPrices] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [error, setError] = useState("");

  const { plan, isPaid, openBillingPortal } = useSubscription();

  useEffect(() => {
    fetch("/api/stripe/prices")
      .then((res) => res.json())
      .then((json) => setPrices(json.prices || null))
      .catch(() => setPrices(null));
  }, []);

  const startCheckout = async (planId) => {
    setError("");
    setLoadingAction(`checkout:${planId}`);

    try {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo iniciar Stripe Checkout");
      }

      window.location.assign(json.url);
    } catch (err) {
      setError(err.message);
      setLoadingAction(null);
    }
  };

  const manageSubscription = async () => {
    setError("");
    setLoadingAction("portal");

    try {
      await openBillingPortal();
    } catch (err) {
      setError(err.message);
      setLoadingAction(null);
    }
  };

  function renderCta(planId) {
    const isCurrent = isPaid && plan.id === planId;
    const isBusy = loadingAction === `checkout:${planId}` || loadingAction === "portal";

    if (isCurrent) {
      return (
        <div
          aria-disabled="true"
          className="mt-10 rounded-full border border-[var(--border)] px-5 py-3 text-center text-sm font-medium text-[var(--text-secondary)] opacity-75"
        >
          Plan actual
        </div>
      );
    }

    if (isPaid) {
      const targetLabel = PRICING_CARD_LABELS[planId] || PLANS[planId].label;
      return (
        <button
          onClick={manageSubscription}
          disabled={isBusy}
          className="mt-10 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition-colors duration-200 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "portal" ? "Abriendo portal..." : `Cambiar a ${targetLabel}`}
        </button>
      );
    }

    return (
      <button
        onClick={() => startCheckout(planId)}
        disabled={isBusy}
        style={{ backgroundColor: PLANS[planId].accent }}
        className="mt-10 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[var(--on-accent)] transition-[opacity,background-color,border-color] duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingAction === `checkout:${planId}`
          ? "Abriendo Stripe..."
          : DEFAULT_PRICING_CTAS[planId] || `Elegir ${PRICING_CARD_LABELS[planId] || PLANS[planId].label}`}
        {!isBusy && <span aria-hidden="true">→</span>}
      </button>
    );
  }

  const proPrice = formatPrice(prices?.pro);
  const teamPrice = formatPrice(prices?.team);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PricingBackButton />
      <MejorarButton />

      <div className="flex min-h-screen flex-col pt-16 lg:pt-0">
        <main className="relative flex-1 px-5 py-24 sm:py-32">
          <section className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-[850px] text-center">
              <h1 className="text-balance font-[family-name:var(--font-display)] text-[34px] font-normal leading-[1.08] tracking-[-0.035em] text-[#dedbd5] sm:text-5xl">
                Un plan para cada forma de trabajar.
              </h1>

              <p className="mx-auto mt-6 max-w-md text-base leading-7 text-[var(--text-secondary)]">
                {isPaid
                  ? `Estás en el plan ${plan.label}. Puedes gestionar tu suscripción o cambiar de plan.`
                  : "Empieza gratis y crece a tu ritmo. Cambia de plan cuando quieras, sin ataduras."}
              </p>
            </div>

            {searchParams.get("checkout") === "cancelled" && (
              <div className="mx-auto mt-10 max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--text-secondary)]">
                Checkout cancelado. Puedes volver a intentarlo cuando quieras.
              </div>
            )}

            {error && (
              <p className="mx-auto mt-10 max-w-md rounded-xl border border-red-300/20 bg-red-300/[0.08] p-3 text-center text-xs text-red-100">
                {error}
              </p>
            )}

            <div
              className={`mx-auto mt-20 grid items-start gap-6 ${
                isPaid ? "max-w-4xl lg:grid-cols-2" : "max-w-5xl lg:grid-cols-3"
              }`}
            >
              {!isPaid && (
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 transition-[border-color,background-color] duration-200 hover:bg-[var(--surface-hover)]">
                  <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Gratis
                  </h2>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-normal text-[var(--foreground)]">0 €</span>
                    <span className="text-sm text-[var(--text-secondary)]">/mes</span>
                  </div>

                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    Perfecto para probar Askly sin compromiso.
                  </p>

                  <ul className="mt-8 space-y-3 text-sm text-[var(--text-secondary)]">
                    {PLANS.free.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
                          ✓
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/"
                    className="mt-10 flex w-full items-center justify-center rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition-colors duration-200 hover:bg-[var(--surface-hover)]"
                  >
                    Empezar gratis
                  </Link>
                </article>
              )}

              <article
                className={`relative rounded-2xl border bg-[var(--surface)] p-8 transition-[border-color,background-color] duration-200 hover:bg-[var(--surface-hover)] ${
                  plan.id === "pro"
                    ? "border-[var(--accent)]/60"
                    : "border-[var(--accent)]/40"
                } ${!isPaid ? "lg:-translate-y-4" : ""}`}
              >
                {!isPaid && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--on-accent)]">
                    Recomendado
                  </span>
                )}

                {isPaid && plan.id === "pro" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--on-accent)]">
                    Plan actual
                  </span>
                )}

                <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--foreground)]">
                  Pro
                </h2>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-normal text-[var(--foreground)]">
                    {proPrice ?? "…"}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">/mes</span>
                </div>

                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Para quienes usan Askly cada día.
                </p>

                <ul className="mt-8 space-y-3 text-sm text-[var(--foreground)]">
                  {PLANS.pro.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[var(--accent)]/40 text-[11px] text-[var(--accent)]">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {renderCta("pro")}
              </article>

              <article
                className={`relative rounded-2xl border bg-[var(--surface)] p-8 transition-[border-color,background-color] duration-200 hover:bg-[var(--surface-hover)] ${
                  plan.id === "team"
                    ? "border-[var(--accent)]/60"
                    : "border-[var(--border)]"
                }`}
              >
                {isPaid && plan.id === "team" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--on-accent)]">
                    Plan actual
                  </span>
                )}

                <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Equipos
                </h2>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-normal text-[var(--foreground)]">
                    {teamPrice ?? "…"}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">/mes</span>
                </div>

                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Para equipos que trabajan juntos en Askly.
                </p>

                <ul className="mt-8 space-y-3 text-sm text-[var(--text-secondary)]">
                  {PLANS.team.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {renderCta("team")}
              </article>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--text-secondary)]">
          Cargando planes...
        </main>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
