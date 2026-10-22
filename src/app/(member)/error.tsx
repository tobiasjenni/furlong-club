"use client";
export default function PortalError({ reset }: { reset: () => void }) {
  return <section className="portal-panel"><h1>Your workspace could not be loaded</h1><p className="portal-lead">We could not retrieve your account records. If you just submitted a payment or request, check its status before trying again. Do not send the transfer again while its status is uncertain.</p><div className="portal-actions"><button className="btn-gold" onClick={reset}>Try again</button><a href="mailto:support@furlong.club" className="btn-ghost">Contact support</a></div></section>;
}
