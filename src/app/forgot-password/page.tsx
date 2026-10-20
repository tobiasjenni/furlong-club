import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      <ForgotForm />
    </AuthShell>
  );
}
