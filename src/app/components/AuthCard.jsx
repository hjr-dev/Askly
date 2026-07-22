"use client";

import Link from "next/link";
import { X } from "lucide-react";
import Logo from "@/app/components/Logo";

export default function AuthCard({ title, subtitle, children, footer, closeHref = "/" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-8">
      <div className="relative w-full max-w-md rounded-[20px] bg-[#1c1c1c] p-8 sm:p-10">
        <Link
          href={closeHref}
          aria-label="Cerrar"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/10 hover:text-[var(--foreground)]"
        >
          <X className="size-5" />
        </Link>

        <div className="mb-2 flex justify-center">
          <Logo size={48} />
        </div>

        <h1 className="text-center text-3xl font-normal tracking-[-0.02em] text-[#dedbd5]">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">{subtitle}</p>
        )}

        <div className="mt-8 space-y-3">{children}</div>

        {footer && <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">{footer}</p>}
      </div>
    </div>
  );
}
