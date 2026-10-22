import "server-only";
import { cache } from "react";
import { requireAdmin } from "./auth";
import { db } from "./db";
import { adminCountsQuery } from "./admin-query";

export type AdminCounts = { deposits: number; pending: number; due: number };
// Request-scoped deduplication only; every new request checks current authority.
export const adminCounts = cache(async () => {
  await requireAdmin();
  return (await db.$queryRaw<AdminCounts[]>(adminCountsQuery()))[0];
});
