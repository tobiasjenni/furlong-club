export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#103226" stroke="#e9c46a" strokeWidth="2" />
      <path d="M12 27c2-6 5-10 9-12l-1-3 3 1c3 1 5 3 5 6l-3 1-2-2c-2 2-3 5-3 9z" fill="#e9c46a" />
      <path d="M10 30h20" stroke="#e9c46a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
