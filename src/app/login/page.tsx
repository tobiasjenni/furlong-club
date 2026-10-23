import { privateMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { safeNext } from "@/lib/request";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { clubGateEnabled } from "@/lib/club-gate";
import { ClubEntrance } from "@/app/entrance/ClubEntrance";

export const metadata = { ...privateMetadata, title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; reauth?: string }> }) {
  const { next: requested, reset, reauth } = await searchParams;
  const next = requested ? safeNext(requested) : undefined;
  const user = await currentUser();
  // A forced sign-in after an unverified entrance lookup must render the form,
  // otherwise an existing session could bounce between login and its destination.
  if (user && reauth !== "1") redirect(next ?? "/dashboard");
  if (clubGateEnabled()) return <ClubEntrance next={next} notice={reset ? "Password updated. Please sign in with your new password." : undefined} />;
  return (
    <AuthShell title="Welcome back" subtitle="Your Trading with Harry account, wallet and results, in one place.">
      <LoginForm next={next} notice={reset ? "Password updated. Please sign in with your new password." : undefined} />
    </AuthShell>
  );
}
