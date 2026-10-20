"use client";
import { useActionState, useState } from "react";
import { cancelTrading, manageTrading, requestTrading } from "@/app/actions/trading";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function RequestTradingForm({ requestKey, termsVersion, options, disabled }: { requestKey: string; termsVersion: string; options: readonly { label: string }[]; disabled: boolean }) {
  const [state, action] = useActionState(requestTrading, null);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="requestKey" value={requestKey} /><input type="hidden" name="termsVersion" value={termsVersion} />
    <div><label htmlFor="trading-amount" className="label">Allocation · USD accounting value</label><input id="trading-amount" name="amount" type="number" min="500" max="10000" step="0.01" required className="input" placeholder="500" disabled={disabled} /></div>
    <div><label htmlFor="trading-option" className="label">Receive your payout in</label><select id="trading-option" name="option" className="input" disabled={disabled}>{options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}</select></div>
    <div><label htmlFor="trading-address" className="label">Your external receiving wallet address</label><input id="trading-address" name="address" className="input font-mono text-xs" autoComplete="off" maxLength={100} required disabled={disabled} /></div>
    <div><label htmlFor="trading-address-confirm" className="label">Enter your receiving address again</label><input id="trading-address-confirm" name="confirmAddress" className="input font-mono text-xs" autoComplete="off" maxLength={100} required disabled={disabled} /></div>
    <p className="muted text-xs">Use a wallet you control that supports the selected token and network. The destination cannot be edited after requesting. Cancel a pending request and create a new one to correct it.</p>
    <label className="flex items-start gap-3 text-sm"><input name="destinationConfirmed" type="checkbox" required disabled={disabled} className="mt-1 accent-gold-400" /><span>I checked this receiving address and network and can receive the selected stablecoin there.</span></label>
    <label className="flex items-start gap-3 text-sm"><input name="risk" type="checkbox" required disabled={disabled} className="mt-1 accent-gold-400" /><span>I accept draft terms {termsVersion}: approval locks the allocation for 33 days with no early withdrawal. The proposed 2–3% daily target is unverified and not guaranteed. I can lose some or all of my money. No daily earnings accrue in this app. Payout uses actual recorded results and is sent manually after review; it is not automatic on day 33. Outgoing network fees are paid by the operator.</span></label>
    <FormMessage state={state} /><SubmitButton disabled={disabled}>Request admin approval</SubmitButton>
    <p className="muted text-xs">This request does not reserve funds. Keep enough available balance until approval. Maximum $10,000 across open allocations.</p>
  </form>;
}

export function CancelTradingForm({ id }: { id: string }) {
  const [state, action] = useActionState(cancelTrading, null);
  return <form action={action} className="mt-3 space-y-2"><input type="hidden" name="id" value={id} /><FormMessage state={state} /><SubmitButton className="btn-ghost">Cancel pending request</SubmitButton></form>;
}

export function ManageTradingForm({ id, status, mature, enrollmentOpen, principal, payout, token, network, address }: { id: string; status: string; mature: boolean; enrollmentOpen: boolean; principal: string; payout: string | null; token: string; network: string; address: string }) {
  const [state, action, pending] = useActionState(manageTrading, null);
  const [decision, setDecision] = useState(enrollmentOpen ? "approve" : "reject");
  const [note, setNote] = useState("");
  const [profit, setProfit] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [hash, setHash] = useState("");
  const [verified, setVerified] = useState(false);
  if (!["PENDING", "ACTIVE", "PAYOUT_READY"].includes(status)) return null;
  if (status === "ACTIVE" && !mature) return <p className="muted text-sm">Result and payout controls unlock after the full 33-day period. No early settlement is available.</p>;
  const operation = status === "PENDING" ? decision : status === "ACTIVE" ? "result" : "payout";
  return <form action={action} className="space-y-4 border-t border-white/10 pt-5">
    <input type="hidden" name="id" value={id} />
    <h3 className="text-xl">{status === "PENDING" ? "Review allocation" : status === "ACTIVE" ? "Record actual result" : "Record completed manual payout"}</h3>
    {status === "PENDING" ? <div><label className="label" htmlFor={`decision-${id}`}>Decision</label><select id={`decision-${id}`} name="operation" className="input" value={decision} onChange={e => setDecision(e.target.value)} disabled={pending}>
      {enrollmentOpen && <option value="approve">Approve and lock {principal} for 33 days</option>}<option value="reject">Decline request without locking funds</option></select></div> : <input type="hidden" name="operation" value={operation} />}
    {operation === "result" && <div><label className="label" htmlFor={`profit-${id}`}>Actual net profit / loss · USD accounting value</label><input id={`profit-${id}`} name="profit" type="number" step="0.01" min={-Number(principal)} max="1000000" value={profit} onChange={e => setProfit(e.target.value)} placeholder="Use a minus sign for a loss" required className="input" /><p className="muted mt-2 text-xs">Principal is {principal}. Enter the verified actual net trading result supported by records. Do not enter a forecast or the advertised target. Saving this result is final; verify it before proceeding.</p></div>}
    {operation === "payout" && <>
      <p className="text-sm">{payout === "0.00" ? "Total loss: no transfer is due. Record the closure only after verifying the loss." : <>Send exactly <strong>{payout} {token}</strong> on <strong>{network}</strong> to <code className="break-all">{address}</code> using your external wallet. Pay network fees separately. This form records a completed transfer.</>}</p>
      <div><label className="label" htmlFor={`paid-${id}`}>Confirm exact payout token amount</label><input id={`paid-${id}`} name="payout" type="number" step="0.01" min="0" max="1000000" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} required className="input" /></div>
      {payout !== "0.00" && <div><label className="label" htmlFor={`payout-hash-${id}`}>Confirmed outgoing transaction ID</label><input id={`payout-hash-${id}`} name="transactionHash" value={hash} onChange={e => setHash(e.target.value)} autoComplete="off" pattern="(0x)?[a-fA-F0-9]{64}" maxLength={66} required className="input font-mono text-xs" /></div>}
    </>}
    <div><label className="label" htmlFor={`trading-note-${id}`}>Record note · visible to the member</label><textarea id={`trading-note-${id}`} name="note" value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={1000} required rows={3} className="input" /></div>
    <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} required className="mt-1 accent-gold-400" /><span>{operation === "approve" ? "I verified the member, available funds, accepted terms and payout destination. Approval starts the lock immediately." : operation === "reject" ? "I verified this decision and its member-visible reason." : operation === "result" ? "I checked the actual trading result and supporting records. This is not an estimated return." : payout === "0.00" ? "I verified the full loss and that no payout is due." : "I independently verified the completed on-chain payment, exact token amount, token contract, saved network and receiving address. This transfer has not been recorded elsewhere."}</span></label>
    <FormMessage state={state} /><button className="btn-gold" disabled={pending}>{pending ? "Saving…" : ({ approve: "Approve & start 33-day lock", reject: "Decline allocation", result: "Save actual result", payout: payout === "0.00" ? "Record total-loss closure" : "Record completed payout" } as Record<string, string>)[operation]}</button>
  </form>;
}
