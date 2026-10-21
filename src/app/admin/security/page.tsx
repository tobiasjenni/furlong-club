import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminPasskeys } from "@/components/AdminPasskeys";

export default async function AdminSecurityPage() {
  const admin = await requireAdmin();
  const [keys, remainingCodes] = await Promise.all([
    db.adminPasskey.findMany({ where: { userId: admin.id }, select: { id: true, label: true, createdAt: true, lastUsedAt: true }, orderBy: { createdAt: "asc" } }),
    db.adminRecoveryCode.count({ where: { userId: admin.id, usedAt: null } }),
  ]);
  return <section className="card max-w-3xl"><h1 className="mb-6 text-3xl">Admin security</h1><AdminPasskeys next="/admin/security" remainingCodes={remainingCodes} keys={keys.map(k => ({ ...k, createdAt: k.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" }), lastUsedAt: k.lastUsedAt?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? null }))} /></section>;
}
