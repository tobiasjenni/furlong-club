import { requireUser } from "@/lib/auth";
import { walletEnabled } from "@/lib/config";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";

export const metadata = { title: "Wallet" };

// Deposit and withdrawal flows are intentionally not implemented yet. They will be built once the licensed
// banking/KYC partner integration is in place; WALLET_ENABLED only reveals the placeholder UI.
export default async function WalletPage() {
  const user = await requireUser();
  const entries = await db.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <h1 className="text-3xl md:text-4xl">Wallet</h1>
      <div className="card silk-stripes">
        <p className="muted text-sm">Balance</p>
        <p className="mt-1 font-display text-5xl">{usd(user.balanceCents)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-gold" disabled>Deposit USDT / USDC</button>
          <button className="btn-ghost" disabled>Withdraw</button>
        </div>
        <p className="muted mt-4 max-w-xl text-sm">
          {walletEnabled
            ? "Deposits and withdrawals open once account verification is complete."
            : "Deposits and withdrawals are coming soon. They will open once account verification (KYC) is available. Subscriptions can already be paid directly in crypto at checkout."}
        </p>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl">History</h2>
        {entries.length === 0 ? <p className="muted text-sm">No wallet activity yet.</p> : (
          <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{entries.map((e) => <tr key={e.id}><td>{dateTime(e.createdAt)}</td><td>{e.type}</td><td>{usd(e.amountCents)} {e.currency}</td><td>{e.status}</td></tr>)}</tbody></table>
        )}
      </div>
    </div>
  );
}
