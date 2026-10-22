import { notFound } from "next/navigation";
import { refreshAdminPayment } from "@/app/actions/wallet";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { ReviewDepositForm } from "@/components/ManualDepositForms";
import { transactionUrl } from "@/lib/manual-deposits";

export default async function PaymentAudit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refresh?: string }> }) {
  const admin = await requireAdmin();
  const canEdit = admin.role === "SUPER_ADMIN";
  const payment = await db.payment.findUnique({ where: { id: (await params).id }, include: {
    user: true, journal: true, events: { orderBy: { createdAt: "desc" }, take: 100 },
  } });
  if (!payment) notFound();
  const fields = {
    Reference: payment.id, User: payment.user.email, Purpose: payment.purpose,
    "USD invoice": usd(payment.amountCents), Token: `${payment.currency} · ${payment.network}`,
    "Provider reference": payment.providerRef, Status: payment.status,
    "Settlement status": payment.settlementStatus, "Review reason": payment.reviewReason,
    "Payment address": payment.payAddress, "Pooled wallet (saved at creation)": payment.poolAddress,
    "Quoted token amount": payment.payAmount, "Received token amount": payment.receivedAmount?.toFixed(),
    "Delivered token amount": payment.outcomeAmount?.toFixed(), "Delivered currency": payment.outcomeCurrency,
    "Deposit transaction": payment.payinHash, "Pooled transfer transaction": payment.payoutHash,
    "Last provider check": payment.lastCheckedAt ? dateTime(payment.lastCheckedAt) : "Never",
    "Member reported transaction": payment.submittedTxHash,
    "Member reported at": payment.submittedAt ? dateTime(payment.submittedAt) : null,
    "Reviewed by admin": payment.reviewedById,
    "Reviewed at": payment.reviewedAt ? dateTime(payment.reviewedAt) : null,
    "Manual review note": payment.manualReviewNote,
  };
  return <div className="space-y-6"><section className="card"><h2 className="text-2xl">Payment trail</h2>
    {(await searchParams).refresh && <p className="mt-3 text-gold-300">Provider unavailable; retry later.</p>}
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[220px_1fr]">{Object.entries(fields).map(([key, value]) => <div key={key} className="contents"><dt className="muted">{key}</dt><dd className="break-all">{value ?? "—"}</dd></div>)}</dl>
    {canEdit && payment.provider === "nowpayments" && <form action={refreshAdminPayment} className="mt-5"><input type="hidden" name="id" value={payment.id} /><button className="btn-ghost">Reconcile with provider</button></form>}
  </section>
  {payment.provider === "manual" && payment.status === "CONFIRMING" && <section className="card space-y-5">
    <h2 className="text-xl">Review deposit for {payment.user.email}</h2>
    <p className="text-sm">Requested credit: <strong>{usd(payment.amountCents)}</strong>. Verify <strong>{(payment.amountCents / 100).toFixed(2)} {payment.currency}</strong> arrived at the saved receiving address on <strong>{payment.network}</strong>.</p>
    {transactionUrl(payment.network, payment.submittedTxHash) && <a href={transactionUrl(payment.network, payment.submittedTxHash)!} target="_blank" rel="noreferrer" className="inline-block text-sm text-gold-300 underline">Inspect reported transaction ↗</a>}
    {canEdit ? <ReviewDepositForm id={payment.id} submittedHash={payment.submittedTxHash} amount={(payment.amountCents / 100).toFixed(2)} token={payment.currency} network={payment.network} /> : <p className="muted text-sm">Awaiting Super Admin review. Your access is read-only.</p>}
  </section>}
  <section className="card"><h2 className="text-xl">Financial journal</h2>{payment.journal.length ? payment.journal.map(e => <div key={e.id} className="mt-4 text-sm"><p>{e.kind} · {e.description}</p><p className="muted break-all text-xs">{e.operationKey}</p><p>Member credit {e.userDeltaCents} / clearing {e.clearingDeltaCents} / sales {e.revenueDeltaCents} cents</p></div>) : <p className="muted mt-3 text-sm">No journal entry. The payment has not been fulfilled by the wallet ledger.</p>}</section>
  <section className="card"><h2 className="text-xl">Latest 100 immutable provider events</h2>{payment.events.map(e => <details key={e.id} className="mt-3 rounded-xl bg-white/5 p-3 text-sm"><summary className="cursor-pointer">{dateTime(e.createdAt)} · {e.source} · {e.decision}</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(e.payload, null, 2)}</pre></details>)}</section>
  </div>;
}
