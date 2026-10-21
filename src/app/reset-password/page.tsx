import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "./ResetForm";
import Link from "next/link";
import { validPasswordReset } from "@/lib/tokens";

export const metadata = { title: "Reset password", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!await validPasswordReset(token)) return <AuthShell title="Reset link unavailable" subtitle="This link is missing, has expired or was already used. Request a new link to reset your password.">
    <Link href="/forgot-password" className="btn-gold w-full">Get help resetting your password</Link>
    <p className="muted mt-4 text-center text-sm"><Link href="/login" className="text-gold-300 underline">Back to sign in</Link></p>
  </AuthShell>;
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
