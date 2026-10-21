"use server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ADMIN_PASSWORD_COOKIE, ADMIN_PASSWORD_SECONDS, signAdminPassword } from "@/lib/admin-session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { isAdmin } from "@/lib/roles";
import { matchesPassword } from "@/lib/passwords";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import type { FormState } from "@/app/actions/auth";
import { safeAdminNext } from "@/lib/admin-security";

export async function unlockAdmin(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user.role)) return { error: "Admin access is unavailable for this account." };
  if (!await rateLimit(`admin-confirm:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!await matchesPassword(String(form.get("password") ?? ""), user.passwordHash)) return { error: "Your current password is incorrect." };
  const result = await db.$queryRaw<{ confirmed: boolean }[]>`SELECT auth_confirm_admin(${user.id},${user.passwordHash},${user.sessionVersion}::integer,${crypto.randomUUID()}) AS confirmed`;
  if (!result[0]?.confirmed) return { error: "Your account changed. Sign in again before continuing." };
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) redirect("/login");
  store.set(ADMIN_PASSWORD_COOKIE, await signAdminPassword(user, session), { ...sessionCookieOptions, maxAge: ADMIN_PASSWORD_SECONDS });
  redirect(`/admin-unlock/security?next=${encodeURIComponent(safeAdminNext(form.get("next")))}`);
}
