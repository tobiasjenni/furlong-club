import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export const currentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user || user.status !== "ACTIVE") return null;
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
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function startSession(user: { id: string; role: "USER" | "ADMIN" }) {
  const token = await signSession({ uid: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
