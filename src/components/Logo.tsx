// Furlong Club mark: a gold horse head in a turf-green roundel.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#103226" stroke="#e9c46a" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="#e9c46a" strokeOpacity=".35" strokeWidth="1" />
      <g fill="#e9c46a">
        <path d="M36.4 10.6l-1.4 5.6C29.8 18.2 25 22.8 21 28.8L15.4 37.4c-1.4 2.1-.5 4.6 1.8 5.3c2.2.7 4.2.2 5.9-1.2l3.4-2.8c1.7-1.4 3.8-1.5 5.4-.3c1 4.6.2 9-2.1 13.4L45.2 52.2C46.4 43.4 46 34.8 43.6 27C42.2 22 40.4 18.2 38.6 15.6Z" />
        <path d="M40.2 13.4c3.2 2.3 5.6 5.8 7.1 10.2l-2.8-.6c2.4 3.4 3.6 7.6 3.9 12.4l-2.4-1.4c1.4 4.4 1.7 9.4 1 15.2l-.9 1.8C47.4 43 47 34.6 44.6 26.6C43.4 22.4 41.8 18.4 40.2 13.4Z" />
      </g>
      <circle cx="28.4" cy="24.8" r="1.45" fill="#103226" />
      <path d="M17.9 39.6q1.2-.9 2.3.1" stroke="#103226" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
