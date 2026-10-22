"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { buyWithWallet } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { usd } from "@/lib/format";

export function WalletPurchase({ planId, planSlug, priceCents, balanceCents, requestKey, disabled, portal = false }: {
  planId: string; planSlug: string; priceCents: number; balanceCents: number; requestKey: string; disabled: boolean; portal?: boolean;
}) {
  const [state, action] = useActionState(buyWithWallet, null);
  const [purchaseKey] = useState(requestKey);
  return <form action={action} className="space-y-3 border-b border-white/10 pb-5">
    {portal && <input type="hidden" name="experience" value="member" />}
    <h2 className="text-xl">Pay from your wallet</h2>
    <p className="muted text-sm">Available: {usd(balanceCents)} · Purchase: {usd(priceCents)}</p>
    <input type="hidden" name="planId" value={planId} /><input type="hidden" name="priceCents" value={priceCents} />
    <input type="hidden" name="requestKey" value={purchaseKey} />
    <FormMessage state={state} focusOnError />
    {balanceCents < priceCents ? <><p className="muted text-sm">You need {usd(priceCents - balanceCents)} more club credit. After your deposit is approved, return here to confirm the membership purchase.</p><Link className="btn-ghost" href={`/wallet?membership=${encodeURIComponent(planSlug)}#add-funds`}>Add funds for this membership</Link></>
      : <SubmitButton disabled={disabled} pendingLabel="Confirming your membership…">Pay {usd(priceCents)} from wallet</SubmitButton>}
  </form>;
}
