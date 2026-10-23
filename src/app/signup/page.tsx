import { privateMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { safeNext } from "@/lib/request";
import { currentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";
import { emailVerificationRequired } from "@/lib/email-verification";

export const metadata = { ...privateMetadata, title: "Join free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: requested } = await searchParams;
  const next = requested ? safeNext(requested) : undefined;
  if (await currentUser()) redirect(next ?? "/dashboard");
  return (
    <AuthShell title="Join the club for free" subtitle="Create your free account for Trading with Rob. Choose a moon-calendar entry, fund your wallet and request an allocation for Super Admin approval. No paid subscription needed.">
      <SignupForm next={next} verificationRequired={emailVerificationRequired()} />
    </AuthShell>
  );
}
