export default function AuthInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-full border border-white/15 bg-black/40 px-5 py-3.5 text-white placeholder:text-[var(--text-secondary)] transition-colors duration-200 focus:border-[var(--accent)]/60 focus:outline-none ${className}`}
    />
  );
}
