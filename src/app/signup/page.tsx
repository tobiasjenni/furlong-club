import { privateMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { safeNext } from "@/lib/request";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata = { ...privateMetadata, title: "Join free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: requested } = await searchParams;
  const next = requested ? safeNext(requested) : undefined;
  if (await currentUser()) redirect(next ?? "/dashboard");
  return (
    <AuthShell title="Join the club for free" subtitle="Explore the catalogue, manage your wallet and choose paid access when it suits you.">
      <SignupForm next={next} />
    </AuthShell>
  );
}
