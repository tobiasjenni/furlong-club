"use client";
import { useActionState, useState } from "react";
import { startTopup } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function TopupForm({ options, disabled, manual, portal = false, defaultAmount = 50, returnTo }: { options: { value: number; label: string; currency: string; enabled: boolean }[]; disabled: boolean; manual: boolean; portal?: boolean; defaultAmount?: number; returnTo?: string }) {
  const [state, action, pending] = useActionState(startTopup, null);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [selected, setSelected] = useState(options.find(o => o.enabled)?.value ?? options[0]?.value ?? 0);
  const currency = options.find(o => o.value === selected)?.currency ?? "USDT";
  return <form action={action} className="space-y-4" aria-busy={pending}>
    {portal && <input type="hidden" name="experience" value="member" />}
    {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    <label className="label" htmlFor="topup-amount">{manual ? `Amount to send (${currency})` : "Amount to add (USD)"}</label>
    <input id="topup-amount" className="input" name="amount" type="number" inputMode="decimal" min="20" max="10000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required disabled={disabled} />
    <label className="label" htmlFor="topup-network">Pay with</label>
    <select id="topup-network" name="option" className="input" disabled={disabled} value={selected} onChange={event => setSelected(Number(event.target.value))}>
      {options.map(o => <option key={o.value} value={o.value} disabled={!o.enabled}>{o.label}{!o.enabled ? " · unavailable" : ""}</option>)}
    </select>
    <p className="muted text-xs">{manual ? "Choose an amount from 20 to 10,000 tokens. Each USDT or USDC adds $1 of USD club credit after admin approval. Network fees are paid separately." : "You receive the USD credit shown above once payment and transfer are complete. Send the exact token amount on the next page. Network fees are paid separately; provider minimums can vary."}</p>
    <FormMessage state={state} focusOnError />
    <SubmitButton disabled={disabled} pendingLabel="Preparing your deposit…">{manual ? "Show deposit address" : "Continue to deposit"}</SubmitButton>
  </form>;
}
