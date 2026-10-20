"use client";
import { useActionState } from "react";
import { startTopup } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function TopupForm({ options, disabled }: { options: { value: number; label: string; enabled: boolean }[]; disabled: boolean }) {
  const [state, action] = useActionState(startTopup, null);
  return <form action={action} className="space-y-4">
    <label className="label" htmlFor="topup-amount">Amount to add (USD)</label>
    <input id="topup-amount" className="input" name="amount" type="number" min="20" max="1000" step="0.01" defaultValue="50" required disabled={disabled} />
    <label className="label" htmlFor="topup-network">Pay with</label>
    <select id="topup-network" name="option" className="input" disabled={disabled} defaultValue={options.find(o => o.enabled)?.value}>
      {options.map(o => <option key={o.value} value={o.value} disabled={!o.enabled}>{o.label}{!o.enabled ? " · unavailable" : ""}</option>)}
    </select>
    <p className="muted text-xs">You receive the USD credit shown above once payment and transfer are complete. Send the exact token amount on the next page. Network fees are paid separately; provider minimums can vary.</p>
    <FormMessage state={state} />
    <SubmitButton disabled={disabled}>Continue to deposit</SubmitButton>
  </form>;
}
