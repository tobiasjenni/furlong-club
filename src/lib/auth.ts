import { isAdmin } from "@/lib/roles";
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";
import { ADMIN_COOKIE, ADMIN_PASSWORD_COOKIE, verifyAdminConfirmation } from "./admin-session";

export const currentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== session.sv) return null;
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");
  if (!await adminConfirmed(user)) redirect("/admin-unlock");
  return user;
}

export async function adminConfirmed(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  return verifyAdminConfirmation(store.get(ADMIN_COOKIE)?.value, user, store.get(SESSION_COOKIE)?.value);
}

export async function requireSuperAdmin() {
  const user = await requireAdmin();
  if (user.role !== "SUPER_ADMIN") redirect("/admin");
  return user;
}

export async function startSession(user: { id: string; role: "USER" | "ADMIN" | "SUPER_ADMIN"; sessionVersion: number }) {
  const token = await signSession({ uid: user.id, role: user.role, sv: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  (await cookies()).delete(ADMIN_COOKIE);
  (await cookies()).delete(ADMIN_PASSWORD_COOKIE);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
  (await cookies()).delete(ADMIN_COOKIE);
  (await cookies()).delete(ADMIN_PASSWORD_COOKIE);
}

// Signs the user out everywhere. Pass keepCurrent to re-issue this browser's session afterwards.
export async function revokeSessions(userId: string, keepCurrent = false) {
  const user = await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  if (keepCurrent) await startSession(user);
  else await endSession();
}
