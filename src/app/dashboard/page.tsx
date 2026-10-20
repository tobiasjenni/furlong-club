import { brand } from "@/lib/config";
import Link from "next/link";
import { VerifyBanner } from "@/components/VerifyBanner";
import { VideoCard } from "@/components/VideoCard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, usd } from "@/lib/format";
import { activeSubscription } from "@/lib/subscriptions";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const sub = await activeSubscription(user.id);
  // Admins can preview every video.
  const tier = user.role === "ADMIN" ? Infinity : sub?.plan.tier ?? 0;
  const latest = await db.video.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 3 });

  return (
    <div className="container-page space-y-8 py-10">
      <div>
        <p className="muted text-sm">{welcome ? "Welcome to the club," : "Good to see you,"}</p>
        <h1 className="text-3xl md:text-4xl">{user.name ?? user.email}</h1>
      </div>

      {!user.emailVerifiedAt && <VerifyBanner email={user.email} />}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="muted text-sm">Your plan</p>
          <p className="mt-1 font-display text-2xl">{sub?.plan.name ?? "Paddock (free)"}</p>
          <p className="muted mt-1 text-sm">{sub ? `Renews or ends ${date(sub.endsAt)}` : "Upgrade to unlock the full library."}</p>
          <Link href="/plans" className="btn-gold mt-4">{sub ? "Extend or upgrade" : "Upgrade"}</Link>
        </div>
        <div className="card">
          <p className="muted text-sm">Wallet balance</p>
          <p className="mt-1 font-display text-2xl">{usd(user.balanceCents)}</p>
          <p className="muted mt-1 text-sm">Deposits and withdrawals are coming soon.</p>
          <Link href="/wallet" className="btn-ghost mt-4">Open wallet</Link>
        </div>
        <div className="card">
          <p className="muted text-sm">Member since</p>
          <p className="mt-1 font-display text-2xl">{date(user.createdAt)}</p>
          <Link href="/account" className="btn-ghost mt-4">Account settings</Link>
        </div>
      </div>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl">Latest from {brand.host.first}</h2>
          <Link href="/videos" className="text-sm text-gold-300 hover:underline">All videos →</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((v) => <VideoCard key={v.id} video={v} locked={v.minTier > tier} />)}
        </div>
      </section>
    </div>
  );
}
