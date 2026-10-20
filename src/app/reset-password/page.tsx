import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Reset password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
