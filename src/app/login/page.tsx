import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to watch your videos and manage your plan.">
      <LoginForm next={next} />
    </AuthShell>
  );
}
