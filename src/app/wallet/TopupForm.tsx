"use client";
import { useActionState, useState } from "react";
import { startTopup } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function TopupForm({ options, disabled, manual, portal = false, defaultAmount = 50 }: { options: { value: number; label: string; currency: string; enabled: boolean }[]; disabled: boolean; manual: boolean; portal?: boolean; defaultAmount?: number }) {
  const [state, action] = useActionState(startTopup, null);
  const [selected, setSelected] = useState(options.find(o => o.enabled)?.value ?? options[0]?.value ?? 0);
  const currency = options.find(o => o.value === selected)?.currency ?? "USDT";
  return <form action={action} className="space-y-4">
    {portal && <input type="hidden" name="experience" value="member" />}
    <label className="label" htmlFor="topup-amount">{manual ? `Amount to send (${currency})` : "Amount to add (USD)"}</label>
    <input id="topup-amount" className="input" name="amount" type="number" min="20" max="10000" step="0.01" defaultValue={defaultAmount} required disabled={disabled} />
    <label className="label" htmlFor="topup-network">Pay with</label>
    <select id="topup-network" name="option" className="input" disabled={disabled} value={selected} onChange={event => setSelected(Number(event.target.value))}>
      {options.map(o => <option key={o.value} value={o.value} disabled={!o.enabled}>{o.label}{!o.enabled ? " · unavailable" : ""}</option>)}
    </select>
    <p className="muted text-xs">{manual ? "Choose an amount from 20 to 10,000 tokens. Each USDT or USDC adds $1 of USD club credit after admin approval. Network fees are paid separately." : "You receive the USD credit shown above once payment and transfer are complete. Send the exact token amount on the next page. Network fees are paid separately; provider minimums can vary."}</p>
    <FormMessage state={state} />
    <SubmitButton disabled={disabled}>{manual ? "Show deposit address" : "Continue to deposit"}</SubmitButton>
  </form>;
}
