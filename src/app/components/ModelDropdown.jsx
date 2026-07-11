"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const MODELS = [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }];

export default function ModelDropdown() {
  const [open, setOpen] = useState(false);
  const [selected] = useState(MODELS[0].id);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const current = MODELS.find((m) => m.id === selected);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--input-border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      >
        {current.label}
        <ChevronDown className="size-3.5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-xl border border-[var(--input-border)] bg-[var(--surface)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors duration-200 hover:bg-[var(--surface-hover)]"
            >
              {model.label}
              {model.id === selected && <Check className="size-4 text-[var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
