"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Plus } from "lucide-react";
import ModelDropdown from "@/app/components/ModelDropdown";

const MAX_HEIGHT_PX = 200;

export default function Composer({ value, onChange, onSubmit, disabled, placeholder }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
      className="mx-auto flex w-full max-w-[800px] flex-col gap-2 rounded-2xl border border-[var(--input-border)] bg-[var(--input)] px-4 py-3 transition-colors duration-200 focus-within:border-[var(--accent)]/50"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || "¿En qué puedo ayudarte hoy?"}
        className="max-h-[200px] min-h-[28px] w-full resize-none bg-transparent text-base leading-7 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none disabled:opacity-50"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled
          title="Adjuntar archivo (próximamente)"
          aria-label="Adjuntar archivo"
          className="grid size-8 shrink-0 cursor-not-allowed place-items-center rounded-full border border-[var(--input-border)] text-[var(--text-secondary)] opacity-60"
        >
          <Plus className="size-4" />
        </button>

        <div className="flex items-center gap-2">
          <ModelDropdown />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            aria-label="Enviar"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-all duration-200 hover:scale-105 hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:scale-100"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
