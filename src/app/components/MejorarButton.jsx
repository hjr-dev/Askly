"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/app/hooks/useSubscription";

export default function MejorarButton({ hideOnMobile = false }) {
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

  const visibilityClass = hideOnMobile ? "hidden lg:flex" : "flex";

  if (isPaid) {
    return (
      <button
        onClick={handleManage}
        disabled={openingPortal}
        className={`fixed right-4 top-4 z-30 items-center gap-1.5 rounded-full border border-white/[0.07] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.03] hover:text-[var(--foreground)] disabled:opacity-60 ${visibilityClass}`}
      >
        {openingPortal ? "Abriendo..." : plan.ctaLabel}
      </button>
    );
  }

  return (
    <Link
      href="/pricing"
      className={`fixed right-4 top-4 z-30 items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3.5 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/15 hover:text-[var(--accent-hover)] ${visibilityClass}`}
    >
      <span className="hidden sm:inline">Mejorar plan</span>
      <span className="sm:hidden">Mejorar plan</span>
    </Link>
  );
}
