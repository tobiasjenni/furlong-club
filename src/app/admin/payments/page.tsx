import Link from "next/link";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";

export default async function AdminPayments() {
  const payments = await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: true, plan: true } });
  return (
    <div className="card overflow-x-auto p-0 sm:p-0">
      <table className="table">
        <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Coin</th><th>Provider</th><th>Status</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{dateTime(p.createdAt)}</td>
              <td><Link href={`/admin/users/${p.userId}`} className="text-gold-300 hover:underline">{p.user.email}</Link></td>
              <td>{p.plan.name}</td><td>{usd(p.amountCents)}</td><td>{p.currency} · {p.network}</td>
              <td className="text-xs">{p.provider}<br /><span className="muted">{p.providerRef}</span></td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {payments.length === 0 && <p className="muted p-6 text-sm">No payments yet.</p>}
    </div>
  );
}
