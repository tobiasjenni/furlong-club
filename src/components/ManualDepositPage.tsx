import type { Payment } from "@prisma/client";
import Link from "next/link";
import QRCode from "qrcode";
import { dateTime, dateTimeUtc, usd } from "@/lib/format";
import { walletTestMode } from "@/lib/environment";
import { manualDepositLabel, transactionUrl } from "@/lib/manual-deposits";
import { CancelDepositForm, ReportDepositForm } from "./ManualDepositForms";
import { CopyButton } from "@/app/checkout/pay/[id]/CopyButton";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";
import { FundingSteps } from "./FundingSteps";
import { allocationRequestHref } from "@/lib/member-funding";
import { RefreshDepositButton } from "./RefreshDepositButton";

export const networkNames: Record<string, string> = { TRC20: "Tron (TRC-20)", ERC20: "Ethereum (ERC-20)", POLYGON: "Polygon" };

export async function ManualDepositPage({ payment, portal = false }: { payment: Payment; portal?: boolean }) {
  const walletHref = "/wallet";
  const formatDate = portal ? dateTimeUtc : dateTime;
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
  return <div className="container-page funding-receipt-page max-w-2xl space-y-5 py-10">
    {(pending || reviewing) && <AutoRefresh seconds={10} />}
    <Link href={walletHref} className="text-sm text-gold-300 underline">← Back to wallet</Link>
    <section className="card space-y-5">
      <div><p className="muted text-sm">Manual deposit · {payment.currency}</p>
        <h1 className="mt-1 text-3xl">{pending ? "Send your deposit" : manualDepositLabel(payment.status, payment.providerStatus)}</h1>
        <p className="muted mt-2 text-sm">{approved ? `${usd(payment.amountCents)} has been added to your club credit. A deposit alone does not create a trading allocation.` : reviewing ? "Your payment report is with the Super Admin. No credit is available until it is approved. Please do not send the payment again." : cancelled ? "This request was cancelled. Create a new deposit before sending funds." : payment.status === "FAILED" ? "This deposit was not approved. No credit was added." : payment.status === "EXPIRED" ? "This deposit request has expired. Create a new request before sending funds. If you already sent a payment, contact support with your transaction ID." : payment.status === "PARTIAL" ? "This deposit needs review. Contact support before sending any further funds." : "Send the amount below, then tell us once you have sent it."}</p>
      </div>
      {(pending || reviewing || approved) && <FundingSteps step={approved ? 2 : reviewing ? 1 : 0} />}
      {approved && <div className="funding-credit-ready"><h2>Your credit is ready</h2><p className="my-3">Use approved credit for Rob’s next moon entry. Choose your trading amount and personal payout wallet, then send your request for review.</p><Link prefetch={false} href={allocationRequestHref(payment.amountCents, payment.currency, payment.network)} className="funding-action funding-action-green">Use approved funds with Rob →</Link><Link prefetch={false} href={walletHref} className="funding-link mt-4 inline-block">View wallet balance</Link></div>}
      {reviewing && <div className="funding-callout funding-callout-amber"><strong>Transfer reported · awaiting verification</strong>Your credit will appear after Super Admin approval. This page checks for updates automatically. Please don’t send the deposit again.<div className="mt-3"><RefreshDepositButton /></div></div>}
      <div className="rounded-xl border border-gold-400/30 p-4"><p className="muted text-xs">{pending ? "Send exactly" : "Requested deposit"}</p>
        <p className="mt-1 font-display text-3xl">{amount} {payment.currency}</p><p className="mt-2 font-semibold text-gold-300">{network}</p>
        <p className="muted mt-2 text-xs">Club credit after approval: {usd(payment.amountCents)}. One token equals $1 of USD club credit. Pay your sending wallet&apos;s network fee separately.</p></div>
      {pending && <>
        <p className="funding-callout funding-callout-amber">Report your transfer within 60 minutes of creating this request{payment.expiresAt ? ` · expires ${dateTimeUtc(payment.expiresAt)} UTC` : ''}. Unreported requests close automatically. If you have already sent funds, you can still report the transaction from the expired record.</p>
        <p className="text-sm text-cream/80">Use only <strong>{payment.currency}</strong> on <strong>{network}</strong>. Send from your own wallet or exchange account and keep your transaction receipt.</p>
        <div className="funding-receipt-address"><h2>Send funds here to add credit</h2><p className="muted mt-2 text-xs">Club deposit address · {network}</p><code className="select-all">{payment.payAddress}</code>{!test && <CopyButton value={payment.payAddress!} />}{qr && <details className="funding-details"><summary>Show deposit QR code</summary><img src={qr} alt={`${payment.currency} receiving address on ${network}`} className="mx-auto my-4 h-56 w-56 rounded-xl" /><p className="funding-form-note">Scan from your sending wallet. Check the token, network and amount before sending.</p></details>}<p className="funding-form-note">This is the club’s address. For trading payouts, you’ll enter your own personal receiving wallet in the next step.</p></div>
        <ReportDepositForm id={payment.id} />
        <CancelDepositForm id={payment.id} portal={portal} />
      </>}
      {payment.providerStatus === "admin_rejected" && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">Reason: {payment.reviewReason}</p>}
      {(cancelled || payment.status === 'EXPIRED') && <details className="text-sm"><summary className="cursor-pointer text-gold-300">Already sent funds for this {cancelled ? 'cancelled' : 'expired'} request?</summary><div className="mt-4"><p className="muted mb-3 text-xs">Report the existing transaction for review. Do not send it again.</p><ReportDepositForm id={payment.id} /></div></details>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="muted">Status</dt><dd>{manualDepositLabel(payment.status, payment.providerStatus)}</dd>
        <dt className="muted">Reference</dt><dd className="break-all text-xs">{payment.id}</dd>
        <dt className="muted">Created</dt><dd>{formatDate(payment.createdAt)}</dd>
        {payment.submittedAt && <><dt className="muted">Reported sent</dt><dd>{formatDate(payment.submittedAt)}</dd></>}
        {payment.reviewedAt && <><dt className="muted">Reviewed</dt><dd>{formatDate(payment.reviewedAt)}</dd></>}
        {tx && <><dt className="muted">Transaction</dt><dd className="break-all text-xs">{explorer ? <a href={explorer} target="_blank" rel="noreferrer" className="text-gold-300 underline">{tx}</a> : tx}</dd></>}
      </dl>
      <p className="muted text-xs">Questions? Contact <a href="mailto:support@furlong.club" className="text-gold-300 underline">support@furlong.club</a> with your reference and transaction ID.</p>
    </section>
  </div>;
}
