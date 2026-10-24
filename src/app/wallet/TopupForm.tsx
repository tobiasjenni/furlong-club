"use client";
import { useActionState, useState } from "react";
import { startTopup } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import "@/components/funding-flow.css";

export function TopupForm({ options, disabled, manual, portal = false, defaultAmount = 50, returnTo }: { options: { value: number; label: string; currency: string; network: string; enabled: boolean }[]; disabled: boolean; manual: boolean; portal?: boolean; defaultAmount?: number; returnTo?: string }) {
  const [state, action, pending] = useActionState(startTopup, null);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [selected, setSelected] = useState(options.find(o => o.enabled)?.value ?? options[0]?.value ?? 0);
  const currency = options.find(o => o.value === selected)?.currency ?? "USDT";
  return <form action={action} onReset={event => event.preventDefault()} className="space-y-4" aria-busy={pending}>
    {portal && <input type="hidden" name="experience" value="member" />}
    {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    <label className="label" htmlFor="topup-amount">1. {manual ? `Amount to send (${currency})` : "Amount to add (USD)"}</label>
    <div className="funding-presets" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} aria-label="Quick deposit amounts">{[500, 1000, 5000].map(value => <button type="button" key={value} className="funding-choice" disabled={disabled || pending} aria-pressed={Number(amount) === value} onClick={() => setAmount(String(value))}>{value.toLocaleString("en-US")}<small className="block">{currency}</small></button>)}</div>
    <p className="funding-form-note">Choose a quick amount above or enter your exact transfer amount below.</p>
    <input id="topup-amount" aria-label={`Exact deposit amount (${currency})`} className="input" name="amount" type="number" inputMode="decimal" min="20" max="10000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required disabled={disabled || pending} />
    <input type="hidden" name="option" value={selected} />
    <fieldset disabled={disabled || pending}><legend className="label">2. Choose your token and network</legend><div className="funding-routes">{options.filter(o => o.enabled).map(o => <button type="button" key={o.value} className="funding-choice funding-route" aria-pressed={selected === o.value} aria-label={o.label} onClick={() => setSelected(o.value)}><strong>{o.currency}</strong><small>{o.network === "TRC20" ? "Tron · TRC-20" : o.network === "ERC20" ? "Ethereum · ERC-20" : o.network}</small></button>)}</div></fieldset>
    <FormMessage state={state} focusOnError />
    <SubmitButton className="funding-action funding-action-blue" disabled={disabled} pendingLabel="Preparing your deposit…">{manual ? "Get deposit address →" : "Continue to deposit →"}</SubmitButton>
    <p className="funding-form-note">The next page shows where to send {amount || "your chosen amount"} {currency}. Nothing is charged by this button.</p>
    <details className="funding-details"><summary>Deposit limits, credit and fees</summary><p>{manual ? "Choose an amount from 20 to 10,000 tokens. Each USDT or USDC adds $1 of USD club credit after Super Admin approval. Send only on the selected network. Network fees are paid separately." : "You receive the USD credit shown above once payment and transfer are complete. Send the exact token amount on the next page. Network fees are paid separately; provider minimums can vary."}</p></details>
  </form>;
}
