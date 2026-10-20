import Link from "next/link";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export const metadata = { title: "Confirm email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const userId = token ? await consumeToken(token, "VERIFY_EMAIL") : null;
  if (userId) {
    await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await audit(userId, "user.email_verified", userId);
  }
  return (
    <div className="container-page max-w-md py-16 text-center">
      <div className="card">
        <h1 className="text-3xl">{userId ? "Email confirmed" : "Link not valid"}</h1>
        <p className="muted mt-2">
          {userId ? "Thanks, your email is confirmed. You can now upgrade your plan." : "This link has expired or was already used. Sign in and request a new one from your dashboard."}
        </p>
        <Link href="/dashboard" className="btn-gold mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
