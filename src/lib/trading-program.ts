import "server-only";
import { cache } from "react";
import { db } from "./db";
import { tradingRequestsEnabled } from "./trading";

// Request-scoped: the plan cards share one lookup; a pause is visible next request.
export const tradingEnrollmentOpen = cache(async () => tradingRequestsEnabled && Boolean(
  (await db.tradingProgram.findUnique({ where: { id: "harry" }, select: { enrollmentEnabled: true } }))?.enrollmentEnabled,
));
