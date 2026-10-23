import "server-only";
import { cache } from "react";
import { requireUser } from "./auth";
import { db } from "./db";
import { activeSubscription } from "./subscriptions";
import { portalSnapshotQuery } from "./portal-query";
import { safeSnapshot, type PortalSnapshot } from "./portal-metrics";

export const portalIdentity = cache(async () => {
  const user = await requireUser();
  const subscription = await activeSubscription(user.id);
  return { user, subscription };
});

async function financialData(history: boolean) {
  const user = await requireUser();
  const [rows, identity] = await Promise.all([
    db.$queryRaw<{ snapshot: PortalSnapshot }[]>(portalSnapshotQuery(user.id, history)), portalIdentity(),
  ]);
  if (!rows[0]) throw new Error("Account metrics are unavailable");
  return { ...identity, snapshot: safeSnapshot(rows[0].snapshot) };
}
// Request-scoped only: balances and permissions are never cached across users.
export const portalData = cache(() => financialData(true));
export const portalSummary = cache(() => financialData(false));

export const pendingTradingDeposit = cache(async () => {
  const user = await requireUser();
  return db.payment.findFirst({
    where: { userId: user.id, purpose: "WALLET_TOPUP", status: { in: ["PENDING", "CONFIRMING", "PARTIAL"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, status: true },
  });
});
