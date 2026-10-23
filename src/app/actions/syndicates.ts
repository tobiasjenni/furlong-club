"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

export async function setSyndicateEntry(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireSuperAdmin();
  if (!await rateLimit(`syndicate-entry:${admin.id}`, 30, 60000)) return { error: "Please wait a minute before trying again." };
  const id = String(form.get("id") ?? ""), revision = Number(form.get("revision"));
  const enabled = String(form.get("enabled")), note = String(form.get("note") ?? "").trim();
  if (id.length > 100 || !["true", "false"].includes(enabled) || !Number.isInteger(revision) || revision < 1 || note.length < 5 || note.length > 1000) return { error: "Add a reason of 5–1,000 characters and reload the entry if it changed." };
  let result: string;
  try { result = (await db.$queryRaw<{ result: string }[]>`SELECT syndicate_set_entry(${admin.id},${id},${enabled === "true"},${revision}::integer,${note},${crypto.randomUUID()}) AS result`)[0].result; }
  catch { return { error: "The entry was not changed. Reload to check its current state before retrying." }; }
  if (result !== "saved") return { error: result === "stale" ? "This entry changed. Reload before saving." : "Only future entries can be changed by the active Super Admin." };
  for (const route of ["/", "/trading", "/admin/syndicates", "/admin/trading"]) revalidatePath(route);
  revalidatePath("/(member)", "layout");
  return { ok: enabled === "true" ? "Entry reopened for requests and approvals. The change is audited." : "Entry closed to new requests and approvals. Existing reserved allocations retain their saved dates." };
}
