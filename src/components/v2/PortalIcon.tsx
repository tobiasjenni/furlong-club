export type PortalIconName = "overview" | "trading" | "performance" | "activity" | "wallet" | "plans" | "account" | "support" | "arrow" | "clock" | "plus" | "check";
const paths: Record<PortalIconName, string> = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  trading: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  performance: "M3 3v18h18M6 15l4-5 4 3 6-8M16 5h4v4",
  activity: "M3 7h15m-4-4 4 4-4 4M21 17H6m4-4-4 4 4 4",
  wallet: "M3 6a2 2 0 0 1 2-2h14v4H5a2 2 0 0 1-2-2Zm0 0v13a2 2 0 0 0 2 2h16V8M17 12h4v5h-4a2 2 0 0 1 0-5Z",
  plans: "M5 4h14v17l-7-4-7 4V4Zm4 4h6M9 11h6",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  support: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6", clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  plus: "M12 4v16M4 12h16", check: "m5 12 4 4L19 6",
};
export function PortalIcon({ name, className = "" }: { name: PortalIconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden="true"><path d={paths[name]} /></svg>;
}
