"use client";
import { useActionState, useState } from "react";
import { cancelManualDeposit, reportManualDeposit, reviewManualDeposit } from "@/app/actions/wallet";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function ReportDepositForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reportManualDeposit, null);
  const [hash, setHash] = useState("");
  const [sent, setSent] = useState(false);
  return <form action={action} onReset={event => event.preventDefault()} className="space-y-4 border-t border-white/10 pt-5" aria-busy={pending}>
    <input type="hidden" name="id" value={id} />
    <h2 className="text-xl">Already sent your payment?</h2>
    <div><label className="label" htmlFor={`tx-${id}`}>Transaction ID / hash</label>
      <input id={`tx-${id}`} name="transactionHash" className="input font-mono text-xs" placeholder="Paste the transaction ID from your wallet" autoComplete="off" autoCapitalize="none" spellCheck={false} value={hash} onChange={event => setHash(event.target.value)} required maxLength={66} pattern="(0x)?[a-fA-F0-9]{64}" />
      <p className="muted mt-2 text-xs">Find this in your sending wallet&apos;s transaction details after sending.</p></div>
    <label className="flex items-start gap-3 text-sm"><input name="sent" type="checkbox" checked={sent} onChange={event => setSent(event.target.checked)} required className="mt-1 accent-gold-400" /><span>I have sent the exact token amount on the network shown above.</span></label>
    <FormMessage state={state} focusOnError />
    <SubmitButton pendingLabel="Reporting your payment…">I have sent this payment</SubmitButton>
    <p className="muted text-xs">Your wallet is credited only after an admin verifies the incoming transfer.</p>
  </form>;
}

export function CancelDepositForm({ id, portal = false }: { id: string; portal?: boolean }) {
  const [state, action] = useActionState(cancelManualDeposit, null);
  return <form action={action} className="space-y-2"><input type="hidden" name="id" value={id} />{portal && <input type="hidden" name="experience" value="v2" />}<FormMessage state={state} /><SubmitButton className="btn-ghost w-full">Cancel this unsent deposit</SubmitButton></form>;
}

export function ReviewDepositForm({ id, submittedHash, amount, token, network }: { id: string; submittedHash: string | null; amount: string; token: string; network: string }) {
  const [state, action, pending] = useActionState(reviewManualDeposit, null);
  const [decision, setDecision] = useState("approve");
  const [note, setNote] = useState("");
  const [transactionHash, setTransactionHash] = useState(submittedHash ?? "");
  const [verified, setVerified] = useState(false);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={id} />
    <div><label className="label" htmlFor={`decision-${id}`}>Decision</label>
      <select id={`decision-${id}`} name="decision" className="input" value={decision} onChange={event => setDecision(event.target.value)} disabled={pending}><option value="approve">Approve and credit wallet</option><option value="reject">Reject without adding credit</option></select></div>
    <div><label className="label" htmlFor={`verified-tx-${id}`}>Verified receiving transaction ID</label>
      <input id={`verified-tx-${id}`} name="transactionHash" value={transactionHash} onChange={event => setTransactionHash(event.target.value)} disabled={decision === "reject"} className="input font-mono text-xs" autoComplete="off" maxLength={66} required={decision === "approve"} pattern="(0x)?[a-fA-F0-9]{64}" /></div>
    <div><label className="label" htmlFor={`review-note-${id}`}>Review note / rejection reason</label>
      <textarea id={`review-note-${id}`} name="note" value={note} onChange={event => setNote(event.target.value)} className="input" rows={2} required minLength={5} maxLength={1000} placeholder="Record how you verified the receipt and sender, or why it is rejected." />
      <p className="muted mt-1 text-xs">If you reject this deposit, the member will see this reason. For a different received amount, reject it and ask the member to submit the correct amount.</p></div>
    {decision === "approve" && <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="verified" checked={verified} onChange={event => setVerified(event.target.checked)} required className="mt-1 accent-gold-400" />
      <span>I independently verified that exactly <strong>{amount} {token}</strong> arrived at the saved club address on <strong>{network}</strong>, is confirmed, and belongs to this member. A transaction ID alone is not proof of who paid.</span></label>}
    <FormMessage state={state} />
    <button className={decision === "approve" ? "btn-gold" : "btn-ghost text-red-200"} disabled={pending}>{pending ? "Saving…" : decision === "approve" ? "Approve & credit wallet" : "Reject deposit"}</button>
  </form>;
}
