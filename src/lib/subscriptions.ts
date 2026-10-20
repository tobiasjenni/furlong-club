import { db } from "./db";
import crypto from "node:crypto";

export async function activeSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    include: { plan: true },
    orderBy: [{ plan: { tier: "desc" } }, { endsAt: "desc" }],
  });
}

export async function userTier(userId: string) {
  const sub = await activeSubscription(userId);
  return sub?.plan.tier ?? 0;
}

// Extends the user's current period for the same plan, or starts a new one.
export async function grantSubscription(userId: string, planId: string, days: number, source: "payment" | "admin") {
  await db.$queryRaw`SELECT wallet_grant_subscription(${userId}, ${planId}, ${days}::integer, ${source}, ${crypto.randomUUID()})`;
}
