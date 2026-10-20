import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { AutoRefresh } from "@/app/checkout/pay/[id]/AutoRefresh";

export const metadata = { title: "Deposit approvals" };

export default async function DepositApprovals({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.min(100000, Math.max(1, Math.floor(Number((await searchParams).page) || 1)));
  const where = { provider: "manual", status: "CONFIRMING" as const };
  const [payments, total] = await Promise.all([
    db.payment.findMany({ where, include: { user: true }, orderBy: [{ submittedAt: "asc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25 }),
    db.payment.count({ where }),
  ]);
  return <div className="space-y-5">
    <AutoRefresh seconds={30} />
    <div><h2 className="text-3xl">Deposit approvals</h2><p className="muted mt-2 text-sm">{total} reported transfer{total === 1 ? "" : "s"} awaiting review. Verify the receipt and sender in your receiving wallet before adding credit.</p></div>
    <div className="card overflow-x-auto">
      {payments.length ? <table className="table"><thead><tr><th>Reported</th><th>Member</th><th>Amount</th><th>Credit</th><th>Transaction</th><th /></tr></thead>
        <tbody>{payments.map(payment => <tr key={payment.id}><td>{dateTime(payment.submittedAt)}</td>
          <td><Link href={`/admin/users/${payment.userId}`} className="text-gold-300 underline">{payment.user.name || payment.user.email}</Link><span className="muted block text-xs">{payment.user.email}</span></td>
          <td>{payment.payAmount} {payment.currency}<span className="muted block text-xs">{payment.network}</span></td><td>{usd(payment.amountCents)}</td>
          <td className="max-w-40 break-all font-mono text-xs">{payment.submittedTxHash}</td>
          <td><Link href={`/admin/payments/${payment.id}`} className="btn-gold whitespace-nowrap">Review</Link></td></tr>)}</tbody></table>
        : <p className="muted text-sm">No deposits awaiting approval.</p>}
    </div>
    <div className="flex justify-between text-sm">{page > 1 ? <Link href={`/admin/deposits?page=${page - 1}`} className="text-gold-300 underline">← Previous</Link> : <span />}
      {page * 25 < total && <Link href={`/admin/deposits?page=${page + 1}`} className="text-gold-300 underline">Next →</Link>}</div>
  </div>;
}
