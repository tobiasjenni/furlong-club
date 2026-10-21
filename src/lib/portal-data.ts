import "server-only";
import { cache } from "react";
import { requireUser } from "./auth";
import { db } from "./db";
import { activeSubscription } from "./subscriptions";
import { portalSnapshotQuery } from "./portal-query";
import { safeSnapshot, type PortalSnapshot } from "./portal-metrics";

export const portalData = cache(async () => {
  const user = await requireUser();
  const [rows, subscription] = await Promise.all([
    db.$queryRaw<{ snapshot: PortalSnapshot }[]>(portalSnapshotQuery(user.id)),
    activeSubscription(user.id),
  ]);
  if (!rows[0]) throw new Error("Account metrics are unavailable");
  return { user, subscription, snapshot: safeSnapshot(rows[0].snapshot) };
});
