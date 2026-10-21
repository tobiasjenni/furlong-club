import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  if (await currentUser()) redirect("/dashboard");
  const { next, reset } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Your membership, wallet and trading records, in one place.">
      <LoginForm next={next} notice={reset ? "Password updated. Please sign in with your new password." : undefined} />
    </AuthShell>
  );
}
