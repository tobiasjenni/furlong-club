import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "./ForgotForm";
import { emailDelivers } from "@/lib/email";
import { brand } from "@/lib/config";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle={emailDelivers() ? "Enter your email to request a password reset link." : "Email recovery is temporarily unavailable. Contact support for help getting back into your account."}>
      {emailDelivers() ? <ForgotForm /> : <a href={`mailto:${brand.supportEmail}`} className="btn-gold w-full">Contact support</a>}
    </AuthShell>
  );
}
