"use client";
import { useActionState, useState } from "react";
import { cancelTrading, manageTrading, requestTrading } from "@/app/actions/trading";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import Link from "next/link";
import { entryDate, moonPhaseName, type SyndicateEntry } from "@/lib/syndicate";
import { allocationCapacity, defaultAllocationAmount, fundingCents } from "@/lib/member-funding";
import { payoutDestinationError, type ClubReceivingAddress } from "@/lib/payout-address";
import "./funding-flow.css";

export function RequestTradingForm({ requestKey, termsVersion, options, disabled, entries, availableCents, committedCents, initialAmount, initialOption = 0, clubAddresses }: { requestKey: string; termsVersion: string; options: readonly { label: string; network: string }[]; disabled: boolean; entries: SyndicateEntry[]; availableCents: number; committedCents: number; initialAmount?: string; initialOption?: number; clubAddresses: ClubReceivingAddress[] }) {
  const [state, action, pending] = useActionState(requestTrading, null);
  const [intentKey] = useState(requestKey);
  const [amount, setAmount] = useState(() => defaultAllocationAmount(availableCents, committedCents, initialAmount));
  const [option, setOption] = useState(String(options[initialOption] ? initialOption : 0));
  const [address, setAddress] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [risk, setRisk] = useState(false);
  const [entryId, setEntryId] = useState(entries[0]?.id ?? "");
  const selectedEntry = entries.find(entry => entry.id === entryId);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const capacity = allocationCapacity(availableCents, committedCents);
  const locked = disabled || pending || capacity < 50000;
  const resetConsent = () => { setRisk(false); setDestinationConfirmed(false); setError(null); };
  const validateAmount = () => {
    const value = fundingCents(amount);
    if (value === null || value < 50000 || value > capacity) return `Choose an amount from $500 to $${(capacity / 100).toFixed(2)} using your approved credit.`;
    if (!selectedEntry || new Date(selectedEntry.startsAt).getTime() <= Date.now()) return "Choose a future entry. If this date has closed, refresh to see the next entries.";
    return null;
  };
  const validateWallet = () => payoutDestinationError(options[Number(option)]?.network ?? "", address, confirmation, clubAddresses);
  const showError = (message: string, field: string) => { setError(message); requestAnimationFrame(() => document.getElementById(field)?.focus()); };
  const advance = () => {
    const message = step === 0 ? validateAmount() : validateWallet();
    if (message) { showError(message, step === 0 ? "trading-amount" : "trading-address"); return; }
    setError(null); setStep(value => Math.min(2, value + 1));
    requestAnimationFrame(() => document.getElementById("trading-step-title")?.focus());
  };
  if (state?.ok) return <div className="funding-credit-ready" role="status"><h3>Trading request received</h3><p className="mt-3">Your request is with the Super Admin. Funds remain available until approval, which reserves them for your selected moon entry.</p><Link prefetch={false} className="funding-link mt-4 inline-block" href="/allocations#allocations">View your request →</Link></div>;
  return <form action={action} onReset={event => event.preventDefault()} onSubmit={event => {
    if (step < 2) { event.preventDefault(); advance(); return; }
    const amountError = validateAmount(); const walletError = validateWallet();
    if (locked || amountError || walletError) { event.preventDefault(); setStep(amountError ? 0 : 1); showError(amountError ?? walletError ?? "Requests are currently unavailable.", amountError ? "trading-amount" : "trading-address"); }
  }} className="funding-wizard space-y-4" aria-busy={pending}>
    <input type="hidden" name="requestKey" value={intentKey} /><input type="hidden" name="termsVersion" value={termsVersion} />
    <input type="hidden" name="amount" value={amount} /><input type="hidden" name="entryId" value={entryId} /><input type="hidden" name="option" value={option} /><input type="hidden" name="address" value={address} /><input type="hidden" name="confirmAddress" value={confirmation} />
    <nav className="funding-wizard-nav" aria-label="Trading request steps">{["Amount & entry", "Payout wallet", "Review"].map((label, index) => <span key={label} aria-current={step === index ? "step" : undefined}>{index + 1}. {label}</span>)}</nav>
    <h3 id="trading-step-title" tabIndex={-1} className="text-xl">{["Choose your trading amount", "Where should we pay you?", "Check your trading request"][step]}</h3>
    <fieldset hidden={step !== 0} disabled={locked || step !== 0} className="funding-wizard-fields"><legend className="sr-only">Amount and entry</legend>
      <p className="funding-inline-balance">Approved credit: <strong>${(availableCents / 100).toFixed(2)}</strong></p>
      <div><label htmlFor="trading-amount" className="label">Amount to trade · USD credit</label><input id="trading-amount" type="number" inputMode="decimal" min="500" max={capacity / 100} step="0.01" value={amount} onChange={event => { setAmount(event.target.value); resetConsent(); }} required className="input" aria-describedby={error ? "trading-input-error" : undefined} /></div>
      <div className="funding-presets" aria-label="Quick trading amounts">{[500, 1000, 2500].filter(value => value * 100 <= capacity).map(value => <button key={value} type="button" className="funding-choice" aria-pressed={fundingCents(amount) === value * 100} onClick={() => { setAmount(String(value)); resetConsent(); }}>${value.toLocaleString("en-US")}</button>)}<button type="button" className="funding-choice" onClick={() => { setAmount((capacity / 100).toFixed(2)); resetConsent(); }}>Use maximum</button></div>
      <div><label htmlFor="trading-entry" className="label">Choose your moon entry</label><select id="trading-entry" className="input" value={selectedEntry ? entryId : ""} onChange={event => { setEntryId(event.target.value); resetConsent(); }} required><option value="" disabled>Select a future entry</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entryDate(entry.startsAt)} · {moonPhaseName(entry.phase)}</option>)}</select></div>
      {selectedEntry && <p className="funding-callout funding-callout-green">Starts {entryDate(selectedEntry.startsAt)} at 00:00 UTC. Matures {entryDate(selectedEntry.endsAt)} after 28 days. Approval is required before the start.</p>}
    </fieldset>
    <fieldset hidden={step !== 1} disabled={locked || step !== 1} className="funding-wizard-fields"><legend className="sr-only">Personal payout wallet</legend>
      <p className="funding-callout">Open your <strong>own wallet or exchange → Receive</strong>. Choose the token and network below, then copy your receiving address. The club’s deposit address belongs to the club; it cannot receive your payout for you.</p>
      <div><label htmlFor="trading-option" className="label">Receive your payout in</label><select id="trading-option" className="input" value={option} onChange={event => { setOption(event.target.value); resetConsent(); }}>{options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}</select></div>
      <div><label htmlFor="trading-address" className="label">Your personal receiving address</label><input id="trading-address" className="input font-mono text-xs" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} value={address} onChange={event => { setAddress(event.target.value); resetConsent(); }} required aria-describedby={error ? "trading-input-error" : undefined} /></div>
      <div><label htmlFor="trading-address-confirm" className="label">Confirm your receiving address</label><input id="trading-address-confirm" className="input font-mono text-xs" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} value={confirmation} onChange={event => { setConfirmation(event.target.value); resetConsent(); }} required /></div>
      <p className="funding-form-note">Check that your wallet supports this exact token and network. To change the destination after submission, cancel the pending request and create a new one.</p>
    </fieldset>
    <fieldset hidden={step !== 2} disabled={locked || step !== 2} className="funding-wizard-fields"><legend className="sr-only">Review and consent</legend>
      <dl className="funding-review"><div><dt>Trading amount</dt><dd>${Number(amount).toFixed(2)} USD credit</dd></div><div><dt>Entry · 00:00 UTC</dt><dd>{selectedEntry && entryDate(selectedEntry.startsAt)}</dd></div><div><dt>28-day maturity</dt><dd>{selectedEntry && entryDate(selectedEntry.endsAt)}</dd></div><div><dt>Payout route</dt><dd>{options[Number(option)]?.label}</dd></div><div><dt>Your payout wallet</dt><dd className="break-all font-mono text-xs">{address}</dd></div></dl>
      <ul className="funding-key-terms"><li>Approval reserves your capital until the selected start and 28-day maturity. No early withdrawal.</li><li>You can lose some or all capital. Daily targets are unverified and not guaranteed; no daily earnings accrue in the app.</li><li>Payout uses actual recorded results and is sent manually after review. It is not automatic on day 28. The operator pays outgoing network fees.</li></ul>
      <label className="funding-acknowledgement"><input name="destinationConfirmed" type="checkbox" checked={destinationConfirmed} onChange={event => setDestinationConfirmed(event.target.checked)} required /><span>I checked my receiving address and can receive this token on the selected network.</span></label>
      <label className="funding-acknowledgement"><input name="risk" type="checkbox" checked={risk} onChange={event => setRisk(event.target.checked)} required /><span>I understand the risks, lock and manual payout above and accept the <Link className="funding-link" href="/legal/terms#trading-terms" target="_blank" rel="noreferrer">allocation terms</Link>.</span></label>
    </fieldset>
    {error && <p id="trading-input-error" role="alert" className="funding-form-error">{error}</p>}<FormMessage state={state} focusOnError />
    <div className="funding-wizard-controls">{step > 0 && <button type="button" className="btn-ghost" disabled={pending} onClick={() => { setStep(value => value - 1); setError(null); requestAnimationFrame(() => document.getElementById("trading-step-title")?.focus()); }}>Back</button>}{step < 2 ? <button type="button" className="funding-action funding-action-green" disabled={locked} onClick={advance}>{step === 0 ? "Continue to payout wallet →" : "Review request →"}</button> : <SubmitButton className="funding-action funding-action-green" disabled={locked} pendingLabel="Saving your request…">Submit trading request</SubmitButton>}</div>
    <p className="funding-form-note">No fee to request. Your funds stay available until Super Admin approval. Maximum $10,000 across open allocations.</p>
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
  if (status === "ACTIVE" && !mature) return <p className="muted text-sm">Result and payout controls unlock after this allocation’s saved maturity. Its original terms remain in force.</p>;
  const operation = status === "PENDING" ? decision : status === "ACTIVE" ? "result" : "payout";
  return <form action={action} className="space-y-4 border-t border-white/10 pt-5">
    <input type="hidden" name="id" value={id} />
    <h3 className="text-xl">{status === "PENDING" ? "Review allocation" : status === "ACTIVE" ? "Record actual result" : "Record completed manual payout"}</h3>
    {status === "PENDING" ? <div><label className="label" htmlFor={`decision-${id}`}>Decision</label><select id={`decision-${id}`} name="operation" className="input" value={decision} onChange={e => setDecision(e.target.value)} disabled={pending}>
      {enrollmentOpen && <option value="approve">Approve and reserve {principal} for the selected entry</option>}<option value="reject">Decline request without locking funds</option></select></div> : <input type="hidden" name="operation" value={operation} />}
    {operation === "result" && <div><label className="label" htmlFor={`profit-${id}`}>Actual net profit / loss · USD accounting value</label><input id={`profit-${id}`} name="profit" type="number" step="0.01" min={-Number(principal)} max="1000000" value={profit} onChange={e => setProfit(e.target.value)} placeholder="Use a minus sign for a loss" required className="input" /><p className="muted mt-2 text-xs">Principal is {principal}. Enter the verified actual net trading result supported by records. Do not enter a forecast or the advertised target. Saving this result is final; verify it before proceeding.</p></div>}
    {operation === "payout" && <>
      <p className="text-sm">{payout === "0.00" ? "Total loss: no transfer is due. Record the closure only after verifying the loss." : <>Send exactly <strong>{payout} {token}</strong> on <strong>{network}</strong> to <code className="break-all">{address}</code> using your external wallet. Pay network fees separately. This form records a completed transfer.</>}</p>
      <div><label className="label" htmlFor={`paid-${id}`}>Confirm exact payout token amount</label><input id={`paid-${id}`} name="payout" type="number" step="0.01" min="0" max="1000000" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} required className="input" /></div>
      {payout !== "0.00" && <div><label className="label" htmlFor={`payout-hash-${id}`}>Confirmed outgoing transaction ID</label><input id={`payout-hash-${id}`} name="transactionHash" value={hash} onChange={e => setHash(e.target.value)} autoComplete="off" pattern="(0x)?[a-fA-F0-9]{64}" maxLength={66} required className="input font-mono text-xs" /></div>}
    </>}
    <div><label className="label" htmlFor={`trading-note-${id}`}>Record note · visible to the member</label><textarea id={`trading-note-${id}`} name="note" value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={1000} required rows={3} className="input" /></div>
    <label className="flex items-start gap-3 text-sm"><input name="verified" type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} required className="mt-1 accent-gold-400" /><span>{operation === "approve" ? "I verified the member, available funds, accepted terms and payout destination. Approval reserves funds immediately; trading starts at the saved syndicate entry and matures 28 days later." : operation === "reject" ? "I verified this decision and its member-visible reason." : operation === "result" ? "I checked the actual trading result and supporting records. This is not an estimated return." : payout === "0.00" ? "I verified the full loss and that no payout is due." : "I independently verified the completed on-chain payment, exact token amount, token contract, saved network and receiving address. This transfer has not been recorded elsewhere."}</span></label>
    <FormMessage state={state} /><button className="btn-gold" disabled={pending}>{pending ? "Saving…" : ({ approve: "Approve & reserve for entry", reject: "Decline allocation", result: "Save actual result", payout: payout === "0.00" ? "Record total-loss closure" : "Record completed payout" } as Record<string, string>)[operation]}</button>
  </form>;
}
