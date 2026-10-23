import Link from "next/link";
import { subscriptionSalesEnabled } from "@/lib/subscription-sales";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { simulatePayment } from "@/app/actions/checkout";
import { refreshMyPayment } from "@/app/actions/wallet";
import { mockPaymentsAllowed } from "@/lib/payments";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { AutoRefresh } from "./AutoRefresh";
import { CopyButton } from "./CopyButton";
import { ManualDepositPage } from "@/components/ManualDepositPage";

export const metadata = { title: "Payment" };
const networks: Record<string, string> = { TRC20: "Tron (TRC-20)", ERC20: "Ethereum (ERC-20)", POLYGON: "Polygon" };

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refresh?: string }> }) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: (await params).id, userId: user.id }, include: { plan: true } });
  if (!payment) notFound();
  if (payment.provider === "manual") return <ManualDepositPage payment={payment} />;
  if (payment.status === "PENDING" && payment.expiresAt && payment.expiresAt < new Date()) {
    await db.$executeRaw`UPDATE "Payment" SET status='EXPIRED', "updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=${payment.id} AND status='PENDING'`;
    // Another notification may have completed this invoice while it was being read. Reload it.
    const latest = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    Object.assign(payment, latest);
  }
  const topup = payment.purpose === "WALLET_TOPUP";
  const settled = payment.status === "CONFIRMED";
  const reviewing = Boolean(payment.reviewReason);
  const open = ["PENDING", "CONFIRMING", "PARTIAL"].includes(payment.status) || reviewing;
  const canSend = (topup || subscriptionSalesEnabled) && payment.status === "PENDING" && !reviewing && Boolean(payment.payAddress && payment.payAmount);
  const mock = payment.provider === "mock";
  const qr = canSend && !mock ? await QRCode.toDataURL(payment.payAddress!, { margin: 1, width: 240, color: { dark: "#06140f", light: "#f6f1e7" } }) : null;
  const steps = ["Payment created", "Payment confirming", "Transfer to club wallet", topup ? "Wallet credited" : "Membership active"];
  const stage = settled ? 3 : payment.settlementStatus === "TRANSFERRING" ? 2 : payment.status === "CONFIRMING" ? 1 : 0;
  return <div className="container-page max-w-2xl space-y-5 py-10">
    {open && <AutoRefresh />}
    <Link href={topup ? "/wallet" : "/plans"} className="text-sm text-gold-300 underline">← {topup ? "Back to wallet" : "Back to plans"}</Link>
    <section className="card space-y-5">
      {mock && <p role="alert" className="rounded-xl border border-gold-400/40 bg-gold-400/10 p-3 text-sm text-gold-300">Test payment only. Do not send real cryptocurrency to this address.</p>}
      <div><p className="muted text-sm">{topup ? "Wallet top-up" : payment.planName} · {usd(payment.amountCents)}</p>
        <h1 className="mt-1 text-3xl">{reviewing ? "Payment needs review" : settled ? topup ? "Your wallet is credited" : "Your membership is active" : "Complete your payment"}</h1>
        <p className="muted mt-2 text-sm">{settled ? `${usd(payment.amountCents)} ${topup ? "has been added to your USD credit balance." : "paid for your membership."}` : "Your balance or membership updates after the provider completes the payment and transfer."}</p>
      </div>
      <ol aria-label="Payment progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, i) => <li key={step} aria-current={i === stage ? "step" : undefined} className={`rounded-xl p-3 text-xs ${!reviewing && i <= stage ? "bg-emerald-500/10 text-emerald-200" : "bg-white/5 text-cream/60"}`}><span className="mb-1 block text-base">{!reviewing && i <= stage ? "✓" : i + 1}</span>{step}</li>)}
      </ol>
      {reviewing && <p role="alert" className="rounded-xl bg-gold-400/10 p-3 text-sm text-gold-300">We&apos;ve saved your payment details for review. Don&apos;t send another payment to this address. Contact support with the reference below.</p>}
      {(await searchParams).refresh && <p role="status" className="text-sm text-gold-300">The payment provider is temporarily unavailable. Your payment record is safe; please check again shortly.</p>}
      {!topup && !subscriptionSalesEnabled && !settled && <p role="status" className="rounded-xl bg-gold-400/10 p-3 text-sm text-gold-300">Subscription sales are paused. Do not send a new payment for this invoice. Any transfer already sent can still be reviewed; contact support with your reference.</p>}
      {canSend && <>
        <div className="rounded-xl border border-gold-400/30 p-4"><p className="muted text-xs">Send exactly</p><p className="mt-1 break-all font-display text-3xl">{payment.payAmount} {payment.currency}</p>
          <p className="mt-2 font-semibold text-gold-300">Network: {networks[payment.network] ?? payment.network}</p>
          <p className="muted mt-1 text-xs">Use only this token and network. A different network can result in lost funds. Pay your sending wallet&apos;s network fee separately.</p></div>
        {qr && <img src={qr} alt={`${payment.currency} deposit address on ${networks[payment.network]}`} className="mx-auto h-56 w-56 rounded-xl" />}
        <div><p className="label">One-time payment address</p><div className="flex items-center gap-2 rounded-xl border border-white/15 bg-turf-950/60 p-3">
          <code className="min-w-0 flex-1 break-all text-xs">{payment.payAddress}</code>{!mock && <CopyButton value={payment.payAddress!} />}
        </div></div>
        <p className="muted text-xs">{payment.expiresAt ? `Pay before ${dateTime(payment.expiresAt)}.` : "Send promptly; the provider's quote may expire."} Use this address only for this payment. After sending, wait for confirmation.</p>
      </>}
      {!canSend && !settled && !reviewing && <p className="rounded-xl bg-white/5 p-4 text-sm">{payment.status === "CONFIRMING" ? "Your payment is being confirmed or transferred. No further payment is needed." : payment.status === "PARTIAL" ? "An incomplete payment was received. Contact support before sending anything else." : "This payment is closed. Do not send funds to its address."}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="muted">Status</dt><dd>{payment.status}</dd>
        <dt className="muted">Transfer</dt><dd>{payment.settlementStatus === "SETTLED" ? "Provider reports transfer complete" : payment.settlementStatus.toLowerCase()}</dd>
        {payment.receivedAmount && <><dt className="muted">Received</dt><dd>{payment.receivedAmount.toFixed()} {payment.currency}</dd></>}
        <dt className="muted">Reference</dt><dd className="break-all text-xs">{payment.id}</dd>
        {payment.payinHash && <><dt className="muted">Deposit transaction</dt><dd className="break-all text-xs">{payment.payinHash}</dd></>}
        {payment.payoutHash && <><dt className="muted">Transfer transaction</dt><dd className="break-all text-xs">{payment.payoutHash}</dd></>}
      </dl>
      {settled && !reviewing && <Link href={topup ? "/wallet" : "/videos"} className="btn-gold w-full">{topup ? "View wallet balance" : "Go to the videos"}</Link>}
      {payment.provider === "nowpayments" && <form action={refreshMyPayment}><input type="hidden" name="id" value={payment.id} /><button className="btn-ghost w-full">Check payment status</button></form>}
      {!open && !settled && (topup || subscriptionSalesEnabled) && <Link href={topup ? "/wallet" : `/checkout/${payment.plan!.slug}`} className="btn-gold w-full">Start a new payment</Link>}
      {mock && !settled && (topup || subscriptionSalesEnabled) && mockPaymentsAllowed() && <form action={simulatePayment} className="rounded-xl border border-dashed border-gold-400/40 p-3">
        <input type="hidden" name="id" value={payment.id} /><button className="btn-ghost w-full">Simulate completed payment (test only)</button>
      </form>}
      <p className="muted text-xs">Need help? Email <a className="text-gold-300 underline" href="mailto:support@furlong.club">support@furlong.club</a> and include your payment reference.</p>
    </section>
  </div>;
}
