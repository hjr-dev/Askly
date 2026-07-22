"use client";

const MODEL_LABEL = "Qwen 3 32B";

export default function ModelDropdown() {
  return (
    <span
      title={MODEL_LABEL}
      aria-label={`Modelo activo: ${MODEL_LABEL}`}
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--input-border)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] sm:px-3"
    >
      <span aria-hidden="true" className="sm:hidden">
        Qwen 3
      </span>
      <span aria-hidden="true" className="hidden sm:inline">
        {MODEL_LABEL}
      </span>
    </span>
  );
}
