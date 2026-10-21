import { redirect } from "next/navigation";
import { requireUser, adminConfirmed } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { privateMetadata } from "@/lib/seo";
import { AuthShell } from "@/components/AuthShell";
import { UnlockForm } from "./UnlockForm";
import { safeAdminNext } from "@/lib/admin-security";

export const metadata = { ...privateMetadata, title: "Confirm admin access" };
export default async function AdminUnlockPage({ searchParams }: { searchParams: Promise<{ refresh?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/dashboard");
  if (!params.refresh && await adminConfirmed(user)) redirect(next);
  return <AuthShell title="Confirm admin access" subtitle="First confirm your password. Then verify with your passkey or a recovery code."><UnlockForm next={next} /></AuthShell>;
}
