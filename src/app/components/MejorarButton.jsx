"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/app/hooks/useSubscription";

export default function MejorarButton() {
  const [openingPortal, setOpeningPortal] = useState(false);
  const { plan, isPaid, loading, openBillingPortal } = useSubscription();

  const handleManage = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      await openBillingPortal();
    } catch {
      setOpeningPortal(false);
    }
  };

  if (loading) return null;

  if (isPaid) {
    return (
      <button
        onClick={handleManage}
        disabled={openingPortal}
        className="fixed right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-60"
      >
        {openingPortal ? "Abriendo..." : plan.ctaLabel}
      </button>
    );
  }

  return (
    <Link
      href="/pricing"
      className="fixed right-4 top-4 z-30 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition-colors duration-200 hover:bg-[var(--accent-hover)]"
    >
      <span className="hidden sm:inline">Mejorar Plan</span>
      <span className="sm:hidden">Mejorar</span>
    </Link>
  );
}
