import { WorkspaceRecordList } from "@/components/WorkspaceRecordList";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { expireManualDeposits } from "@/lib/manual-deposits";

export default async function AdminPayments() {
  await requireAdmin();
  await expireManualDeposits();
  const payments = await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: true, plan: true } });
  return (
    <div><WorkspaceRecordList empty="No payments yet." records={payments.map(payment => ({ id: payment.id, href: `/admin/payments/${payment.id}`, title: payment.user.email, amount: usd(payment.amountCents), status: payment.status, meta: `${payment.currency} · ${payment.network} · ${dateTime(payment.createdAt)}`, action: "Open payment trail" }))} /><div className="card hidden overflow-x-auto p-0 sm:p-0 md:block">
      <table className="table">
        <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Coin</th><th>Provider</th><th>Status</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{dateTime(p.createdAt)}</td>
              <td><Link href={`/admin/users/${p.userId}`} className="text-gold-300 hover:underline">{p.user.email}</Link></td>
              <td>{p.planName ?? "Wallet top-up"}</td><td>{usd(p.amountCents)}</td><td>{p.currency} · {p.network}</td>
              <td className="text-xs">{p.provider}<br /><span className="muted">{p.providerRef}</span></td>
              <td><Link href={`/admin/payments/${p.id}`} className="text-gold-300 underline">{p.status}</Link><br />{p.settlementStatus}{p.reviewReason && <span className="block text-red-300">Review needed</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {payments.length === 0 && <p className="muted p-6 text-sm">No payments yet.</p>}
    </div></div>
  );
}
