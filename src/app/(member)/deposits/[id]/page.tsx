import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ManualDepositPage } from "@/components/ManualDepositPage";
import ClassicPayPage from "@/app/checkout/pay/[id]/page";
import Link from "next/link";

export const metadata = { title: "Deposit receipt" };
export default async function PortalDeposit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refresh?: string }> }) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!payment) notFound();
  if (payment.provider === "manual") return <div className="mx-auto max-w-3xl"><ManualDepositPage payment={payment} portal /></div>;
  return <div className="mx-auto max-w-3xl"><Link className="text-sm text-gold-300 underline" href="/wallet">← Wallet</Link><ClassicPayPage params={params} searchParams={searchParams} /></div>;
}
