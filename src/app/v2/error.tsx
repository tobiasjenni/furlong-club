"use client";
import Link from "next/link";
export default function PortalError({ reset }: { reset: () => void }) {
  return <section className="portal-panel"><h1>Your workspace could not be loaded</h1><p className="portal-lead">We could not retrieve your account records. No new financial action was submitted. Try again or contact support if this continues.</p><div className="portal-actions"><button className="btn-gold" onClick={reset}>Try again</button><Link href="/v2/support" className="btn-ghost">Contact support</Link></div></section>;
}
