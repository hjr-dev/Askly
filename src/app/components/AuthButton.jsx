export default function AuthButton({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={`w-full rounded-full bg-white px-5 py-3.5 font-medium text-black transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 ${className}`}
    />
  );
}
