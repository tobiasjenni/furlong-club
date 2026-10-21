import { redirect } from "next/navigation";
import { requireUser, adminConfirmed } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { privateMetadata } from "@/lib/seo";
import { AuthShell } from "@/components/AuthShell";
import { UnlockForm } from "./UnlockForm";

export const metadata = { ...privateMetadata, title: "Confirm admin access" };
export default async function AdminUnlockPage() {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/dashboard");
  if (await adminConfirmed(user)) redirect("/admin");
  return <AuthShell title="Confirm admin access" subtitle="Enter your password to view member information and manage funds."><UnlockForm /></AuthShell>;
}
