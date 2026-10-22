import { privateMetadata } from "@/lib/seo";
import Link from "next/link";
import { consumeToken } from "@/lib/tokens";
import { currentUser } from "@/lib/auth";

export const metadata = { ...privateMetadata, title: "Confirm email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const userId = token ? await consumeToken(token, "VERIFY_EMAIL") : null;
  const user = await currentUser();
  const confirmed = Boolean(userId || user?.emailVerifiedAt);

  return (
    <div className="container-page max-w-md py-16 text-center">
      <div className="card">
        <h1 className="text-3xl">{confirmed ? "Email confirmed" : "Link not valid"}</h1>
        <p className="muted mt-2">
          {confirmed ? "Thanks, your email is confirmed. Continue to your account when you are ready." : "This link has expired or was already used. If you have already confirmed your email, simply sign in. Otherwise, request a new link from your dashboard."}
        </p>
        <Link href={user ? "/dashboard" : "/login?next=%2Fdashboard"} className="btn-gold mt-6">{user ? "Go to dashboard" : "Sign in to continue"}</Link>
      </div>
    </div>
  );
}
