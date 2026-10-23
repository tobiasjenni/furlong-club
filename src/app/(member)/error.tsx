"use client";
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const updated = error.name === "UnrecognizedActionError";
  return <section className="portal-panel"><h1>{updated ? "This form has been updated" : "Your workspace could not be loaded"}</h1><p className="portal-lead">{updated ? "Reload to use the latest form. Check your deposit or allocation records before trying again. Reloading will not resubmit your request or send funds." : "We could not retrieve your account records. If you just submitted a payment or request, check its status before trying again. Do not send the transfer again while its status is uncertain."}</p><div className="portal-actions"><button className="btn-gold" onClick={updated ? () => window.location.reload() : reset}>{updated ? "Reload page" : "Try again"}</button><a href="mailto:support@furlong.club" className="btn-ghost">Contact support</a></div></section>;
}
