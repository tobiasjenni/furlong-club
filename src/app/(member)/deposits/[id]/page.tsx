import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ManualDepositPage } from "@/components/ManualDepositPage";
import ClassicPayPage from "@/app/checkout/pay/[id]/page";
import Link from "next/link";
import { membershipReturnPath } from "@/lib/membership-funding";
import { subscriptionSalesEnabled } from "@/lib/subscription-sales";

export const metadata = { title: "Deposit receipt" };
export default async function PortalDeposit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refresh?: string; next?: string }> }) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!payment) notFound();
  const returnTo = subscriptionSalesEnabled ? membershipReturnPath((await searchParams).next) : undefined;
  const plan = returnTo ? await db.plan.findFirst({ where: { slug: returnTo.split("/")[2], active: true, priceCents: { gt: 0 } } }) : null;
  if (payment.provider === "manual") return <div className="mx-auto max-w-3xl"><ManualDepositPage payment={payment} portal />{plan && <section className="portal-panel mt-5"><h2>Your {plan.name} membership</h2><p className="portal-lead">Once this deposit is approved, return to review and confirm the separate membership purchase. Membership does not activate automatically when you deposit.</p><Link prefetch={false} className="btn-gold mt-4" href={returnTo!}>Continue to {plan.name} membership →</Link></section>}</div>;
  return <div className="mx-auto max-w-3xl"><Link prefetch={false} className="text-sm text-gold-300 underline" href="/wallet">← Wallet</Link><ClassicPayPage params={params} searchParams={searchParams} /></div>;
}
