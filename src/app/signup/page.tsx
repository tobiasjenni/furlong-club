import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Join free" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <AuthShell title="Join the club" subtitle="Free account, free intro videos. Upgrade whenever you like.">
      <SignupForm />
    </AuthShell>
  );
}
