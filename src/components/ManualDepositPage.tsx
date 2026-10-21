import type { Payment } from "@prisma/client";
import Link from "next/link";
import QRCode from "qrcode";
import { dateTime, usd } from "@/lib/format";
import { walletTestMode } from "@/lib/environment";
import { manualDepositLabel, transactionUrl } from "@/lib/manual-deposits";
import { CancelDepositForm, ReportDepositForm } from "./ManualDepositForms";
import { CopyButton } from "@/app/checkout/pay/[id]/CopyButton";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

export const networkNames: Record<string, string> = { TRC20: "Tron (TRC-20)", ERC20: "Ethereum (ERC-20)", POLYGON: "Polygon" };

export async function ManualDepositPage({ payment }: { payment: Payment }) {
  const pending = payment.status === "PENDING";
  const reviewing = payment.status === "CONFIRMING";
  const approved = payment.status === "CONFIRMED";
  const cancelled = payment.providerStatus === "cancelled";
  const test = walletTestMode();
  const amount = (payment.amountCents / 100).toFixed(2);
  const network = networkNames[payment.network] ?? payment.network;
  const qr = pending && !test && payment.payAddress ? await QRCode.toDataURL(payment.payAddress, { margin: 1, width: 240, color: { dark: "#06140f", light: "#f6f1e7" } }) : null;
  const tx = payment.payinHash ?? payment.submittedTxHash;
  const explorer = test ? null : transactionUrl(payment.network, tx);
  return <div className="container-page max-w-2xl space-y-5 py-10">
    {reviewing && <AutoRefresh seconds={15} />}
    <Link href="/wallet" className="text-sm text-gold-300 underline">← Back to wallet</Link>
    <section className="card space-y-5">
      <div><p className="muted text-sm">Manual deposit · {payment.currency}</p>
        <h1 className="mt-1 text-3xl">{pending ? "Send your deposit" : manualDepositLabel(payment.status, payment.providerStatus)}</h1>
        <p className="muted mt-2 text-sm">{approved ? `${usd(payment.amountCents)} has been added to your club credit.` : reviewing ? "Your payment report is with an admin. No credit is available until it is approved. Please do not send the payment again." : cancelled ? "This request was cancelled. Create a new deposit before sending funds." : payment.status === "FAILED" ? "This deposit was not approved. No credit was added." : payment.status === "EXPIRED" ? "This deposit request has expired. Create a new request before sending funds. If you already sent a payment, contact support with your transaction ID." : payment.status === "PARTIAL" ? "This deposit needs review. Contact support before sending any further funds." : "Send the amount below, then tell us once you have sent it."}</p>
      </div>
      <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Deposit progress">
        {["1. Send funds", "2. Report sent", "3. Admin approves"].map((label, index) => <li key={label} className={`rounded-xl p-3 ${approved || (reviewing && index < 2) ? "bg-emerald-500/10 text-emerald-200" : "bg-white/5 text-cream/70"}`}>{label}</li>)}
      </ol>
      <div className="rounded-xl border border-gold-400/30 p-4"><p className="muted text-xs">{pending ? "Send exactly" : "Requested deposit"}</p>
        <p className="mt-1 font-display text-3xl">{amount} {payment.currency}</p><p className="mt-2 font-semibold text-gold-300">{network}</p>
        <p className="muted mt-2 text-xs">Club credit after approval: {usd(payment.amountCents)}. One token equals $1 of USD club credit. Pay your sending wallet&apos;s network fee separately.</p></div>
      {pending && <>
        <p className="text-sm text-cream/80">Use only <strong>{payment.currency}</strong> on <strong>{network}</strong>. Send from your own wallet or exchange account and keep your transaction receipt.</p>
        {qr && <img src={qr} alt={`${payment.currency} receiving address on ${network}`} className="mx-auto h-56 w-56 rounded-xl" />}
        <div><p className="label">Club receiving address · {network}</p><div className="flex items-center gap-2 rounded-xl border border-white/15 bg-turf-950/60 p-3"><code className="min-w-0 flex-1 break-all text-xs">{payment.payAddress}</code>{!test && <CopyButton value={payment.payAddress!} />}</div></div>
        <ReportDepositForm id={payment.id} />
        <CancelDepositForm id={payment.id} />
      </>}
      {payment.providerStatus === "admin_rejected" && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">Reason: {payment.reviewReason}</p>}
      {cancelled && <details className="text-sm"><summary className="cursor-pointer text-gold-300">Already sent funds for this cancelled request?</summary><div className="mt-4"><ReportDepositForm id={payment.id} /></div></details>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="muted">Status</dt><dd>{manualDepositLabel(payment.status, payment.providerStatus)}</dd>
        <dt className="muted">Reference</dt><dd className="break-all text-xs">{payment.id}</dd>
        <dt className="muted">Created</dt><dd>{dateTime(payment.createdAt)}</dd>
        {payment.submittedAt && <><dt className="muted">Reported sent</dt><dd>{dateTime(payment.submittedAt)}</dd></>}
        {payment.reviewedAt && <><dt className="muted">Reviewed</dt><dd>{dateTime(payment.reviewedAt)}</dd></>}
        {tx && <><dt className="muted">Transaction</dt><dd className="break-all text-xs">{explorer ? <a href={explorer} target="_blank" rel="noreferrer" className="text-gold-300 underline">{tx}</a> : tx}</dd></>}
      </dl>
      {approved && <Link href="/wallet" className="btn-gold w-full">View wallet balance</Link>}
      <p className="muted text-xs">Questions? Contact <a href="mailto:support@furlong.club" className="text-gold-300 underline">support@furlong.club</a> with your reference and transaction ID.</p>
    </section>
  </div>;
}
