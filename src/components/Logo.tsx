// A custom F monogram enclosed by the oval of a racecourse.
// Keep the mark in app/icon.svg in sync with this artwork.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#06140f" />
      <rect x="10" y="4" width="44" height="56" rx="22" fill="none" stroke="#e9c46a" strokeWidth="1.75" />
      <path
        d="M21 17H43L44 26H41L38 21H29V30H36L38 27H40V37H38L36 34H29V44L34 46V48H20V46L24 44V21L21 19Z"
        fill="#e9c46a"
      />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <span className="inline-flex shrink-0 items-center gap-3 whitespace-nowrap text-cream">
      <Logo className="h-11 w-11 shrink-0" />
      <span className="flex flex-col items-center gap-1">
        <span className="font-display text-[17px] font-medium uppercase leading-none tracking-[0.14em]">Furlong</span>
        <span className="flex w-full items-center gap-2 text-[9px] font-medium uppercase leading-none tracking-[0.32em] text-gold-400">
          <span className="h-px flex-1 bg-gold-400/40" aria-hidden="true" />
          <span className="pl-[0.32em]">Club</span>
          <span className="h-px flex-1 bg-gold-400/40" aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}
