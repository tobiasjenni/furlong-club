"use client";
import Link from "next/link";
import { useActionState } from "react";
import { buyWithWallet } from "@/app/actions/wallet";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { usd } from "@/lib/format";

export function WalletPurchase({ planId, priceCents, balanceCents, requestKey, disabled, portal = false }: {
  planId: string; priceCents: number; balanceCents: number; requestKey: string; disabled: boolean; portal?: boolean;
}) {
  const [state, action] = useActionState(buyWithWallet, null);
  return <form action={action} className="space-y-3 border-b border-white/10 pb-5">
    {portal && <input type="hidden" name="experience" value="member" />}
    <h2 className="text-xl">Pay from your wallet</h2>
    <p className="muted text-sm">Available: {usd(balanceCents)} · Purchase: {usd(priceCents)}</p>
    <input type="hidden" name="planId" value={planId} /><input type="hidden" name="priceCents" value={priceCents} />
    <input type="hidden" name="requestKey" value={requestKey} />
    <FormMessage state={state} />
    {balanceCents < priceCents ? <Link className="btn-ghost" href={portal ? "/wallet#add-funds" : "/wallet"}>Add funds to your wallet</Link>
      : <SubmitButton disabled={disabled}>Pay {usd(priceCents)} from wallet</SubmitButton>}
  </form>;
}
