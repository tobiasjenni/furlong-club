// Rob, the brand mascot: an illustrated character, not a photo of a real person.
export function RobMascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 260" className={className} role="img" aria-label="Illustration of Rob, the Furlong Club mascot">
      <defs>
        <linearGradient id="tweed" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#6b5a3e" />
          <stop offset="1" stopColor="#4a3d2a" />
        </linearGradient>
        <pattern id="check" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5h10M5 0v10" stroke="#8a7550" strokeWidth="1" opacity=".45" />
        </pattern>
      </defs>
      <circle cx="120" cy="130" r="112" fill="#103226" />
      <circle cx="120" cy="130" r="112" fill="none" stroke="#e9c46a" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 6" />
      {/* body */}
      <path d="M48 250c4-52 34-78 72-78s68 26 72 78z" fill="url(#tweed)" />
      <path d="M48 250c4-52 34-78 72-78s68 26 72 78z" fill="url(#check)" />
      <path d="M104 174l16 34 16-34z" fill="#f6f1e7" />
      <path d="M115 184l5 30 5-30-5-6z" fill="#b5332e" />
      <path d="M100 172l20 40-26-10zM140 172l-20 40 26-10z" fill="#3c3122" />
      {/* neck + head */}
      <rect x="108" y="146" width="24" height="26" rx="8" fill="#e8b48f" />
      <ellipse cx="120" cy="116" rx="40" ry="44" fill="#f0c29e" />
      <ellipse cx="80" cy="120" rx="7" ry="11" fill="#e8b48f" />
      <ellipse cx="160" cy="120" rx="7" ry="11" fill="#e8b48f" />
      {/* face */}
      <path d="M98 112q7-6 14 0M128 112q7-6 14 0" stroke="#3b2a1d" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="105" cy="120" r="3.6" fill="#2a1d14" />
      <circle cx="135" cy="120" r="3.6" fill="#2a1d14" />
      <path d="M120 122q-4 12 2 14" stroke="#c98d68" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M104 142q16 12 32 0" stroke="#7a3b2a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M96 136q24 10 48 0q-4 12-24 13q-20-1-24-13z" fill="#8c6a4f" opacity=".55" />
      {/* flat cap */}
      <path d="M76 100q4-38 46-40q40 2 46 34q-30-12-92 6z" fill="url(#tweed)" />
      <path d="M76 100q4-38 46-40q40 2 46 34q-30-12-92 6z" fill="url(#check)" />
      <path d="M70 102q50-20 112-6q-6 10-24 8q-40-8-88-2z" fill="#3c3122" />
      {/* binoculars */}
      <g transform="translate(150 196) rotate(-12)">
        <rect x="0" y="0" width="22" height="34" rx="6" fill="#1d1d1d" />
        <rect x="26" y="0" width="22" height="34" rx="6" fill="#1d1d1d" />
        <rect x="18" y="10" width="12" height="10" fill="#333" />
        <circle cx="11" cy="4" r="6" fill="#e9c46a" opacity=".85" />
        <circle cx="37" cy="4" r="6" fill="#e9c46a" opacity=".85" />
      </g>
    </svg>
  );
}
