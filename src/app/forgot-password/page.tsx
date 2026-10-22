import { privateMetadata } from "@/lib/seo";
import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "./ForgotForm";
import { emailDelivers } from "@/lib/email";
import { brand } from "@/lib/config";
import Link from "next/link";

export const metadata = { ...privateMetadata, title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle={emailDelivers() ? "Enter your email to request a password reset link." : "Email recovery is temporarily unavailable. Contact support for help getting back into your account."}>
      {emailDelivers() ? <ForgotForm /> : <a href={`mailto:${brand.supportEmail}`} className="btn-gold w-full">Contact support</a>}
      {emailDelivers() && <p className="muted mt-4 text-center text-sm">No reset email arriving? <a href={`mailto:${brand.supportEmail}`} className="text-gold-300 underline">Contact the club for help</a>.</p>}
      <p className="muted mt-4 text-center text-sm"><Link href="/login" className="text-gold-300 underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
