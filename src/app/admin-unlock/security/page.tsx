import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { ADMIN_PASSWORD_COOKIE, verifyAdminPassword } from "@/lib/admin-session";
import { SESSION_COOKIE } from "@/lib/session";
import { db } from "@/lib/db";
import { safeAdminNext } from "@/lib/admin-security";
import { AdminPasskeys } from "@/components/AdminPasskeys";
import { AuthShell } from "@/components/AuthShell";
import { privateMetadata } from "@/lib/seo";

export const metadata = { ...privateMetadata, title: "Verify admin device" };
export default async function SecurityStep({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/dashboard");
  const next = safeAdminNext((await searchParams).next);
  const store = await cookies();
  if (!await verifyAdminPassword(store.get(ADMIN_PASSWORD_COOKIE)?.value, user, store.get(SESSION_COOKIE)?.value)) redirect(`/admin-unlock?refresh=1&next=${encodeURIComponent(next)}`);
  const keys = await db.adminPasskey.findMany({ where: { userId: user.id }, select: { id: true, label: true, createdAt: true, lastUsedAt: true } });
  return <AuthShell title="Your second layer of protection" subtitle="Admin access requires your password and a verified device."><AdminPasskeys setup next={next} keys={keys.map(k => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null }))} /></AuthShell>;
}
