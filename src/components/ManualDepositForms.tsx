"use client";
import { useActionState } from "react";
import { cancelManualDeposit, reportManualDeposit, reviewManualDeposit } from "@/app/actions/wallet";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function ReportDepositForm({ id }: { id: string }) {
  const [state, action] = useActionState(reportManualDeposit, null);
  return <form action={action} className="space-y-4 border-t border-white/10 pt-5">
    <input type="hidden" name="id" value={id} />
    <h2 className="text-xl">Already sent your payment?</h2>
    <div><label className="label" htmlFor={`tx-${id}`}>Transaction ID / hash</label>
      <input id={`tx-${id}`} name="transactionHash" className="input font-mono text-xs" placeholder="Paste the transaction ID from your wallet" autoComplete="off" required maxLength={66} pattern="(0x)?[a-fA-F0-9]{64}" />
      <p className="muted mt-2 text-xs">Find this in your sending wallet&apos;s transaction details after sending.</p></div>
    <label className="flex items-start gap-3 text-sm"><input name="sent" type="checkbox" required className="mt-1 accent-gold-400" /><span>I have sent the exact token amount on the network shown above.</span></label>
    <FormMessage state={state} />
    <SubmitButton>I have sent this payment</SubmitButton>
    <p className="muted text-xs">Your wallet is credited only after an admin verifies the incoming transfer.</p>
  </form>;
}

export function CancelDepositForm({ id }: { id: string }) {
  const [state, action] = useActionState(cancelManualDeposit, null);
  return <form action={action} className="space-y-2"><input type="hidden" name="id" value={id} /><FormMessage state={state} /><SubmitButton className="btn-ghost w-full">Cancel this unsent deposit</SubmitButton></form>;
}

export function ReviewDepositForm({ id, submittedHash, amount, token, network }: { id: string; submittedHash: string | null; amount: string; token: string; network: string }) {
  const [state, action, pending] = useActionState(reviewManualDeposit, null);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={id} />
    <div><label className="label" htmlFor={`verified-tx-${id}`}>Verified receiving transaction ID</label>
      <input id={`verified-tx-${id}`} name="transactionHash" defaultValue={submittedHash ?? ""} className="input font-mono text-xs" autoComplete="off" maxLength={66} required pattern="(0x)?[a-fA-F0-9]{64}" /></div>
    <div><label className="label" htmlFor={`review-note-${id}`}>Review note / rejection reason</label>
      <textarea id={`review-note-${id}`} name="note" className="input" rows={2} required minLength={5} maxLength={1000} placeholder="Record how you verified the receipt and sender, or why it is rejected." />
      <p className="muted mt-1 text-xs">If you reject this deposit, the member will see this reason. For a different received amount, reject it and ask the member to submit the correct amount.</p></div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="verified" required className="mt-1 accent-gold-400" />
      <span>I independently verified that exactly <strong>{amount} {token}</strong> arrived at the saved club address on <strong>{network}</strong>, is confirmed, and belongs to this member. A transaction ID alone is not proof of who paid.</span></label>
    <FormMessage state={state} />
    <div className="flex flex-wrap gap-3"><button name="decision" value="approve" className="btn-gold" disabled={pending}>{pending ? "Saving…" : "Approve & credit wallet"}</button>
      <button name="decision" value="reject" className="btn-ghost text-red-200" formNoValidate disabled={pending}>Reject deposit</button></div>
  </form>;
}
