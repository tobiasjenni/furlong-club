import { db } from "./db";

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
  const existing = await db.subscription.findFirst({
    where: { userId, planId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
  });
  const ms = days * 24 * 60 * 60 * 1000;
  if (existing) {
    return db.subscription.update({ where: { id: existing.id }, data: { endsAt: new Date(existing.endsAt.getTime() + ms) } });
  }
  return db.subscription.create({ data: { userId, planId, endsAt: new Date(Date.now() + ms), source } });
}
