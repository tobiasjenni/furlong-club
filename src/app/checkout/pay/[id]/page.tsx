import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { simulatePayment } from "@/app/actions/checkout";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, usd } from "@/lib/format";
import { AutoRefresh } from "./AutoRefresh";
import { CopyButton } from "./CopyButton";

export const metadata = { title: "Payment" };

const networkNote: Record<string, string> = {
  TRC20: "Send only on the Tron (TRC-20) network.",
  ERC20: "Send only on the Ethereum (ERC-20) network.",
  POLYGON: "Send only on the Polygon network.",
};

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: (await params).id, userId: user.id }, include: { plan: true } });
  if (!payment) notFound();

  if (payment.status === "CONFIRMED") {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <div className="card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300">✓</div>
          <h1 className="mt-4 text-3xl">You&apos;re in</h1>
          <p className="muted mt-2">Payment received. {payment.plan.name} is now active on your account.</p>
          <Link href="/videos" className="btn-gold mt-6">Go to the videos</Link>
        </div>
      </div>
    );
  }

  const open = payment.status === "PENDING" || payment.status === "CONFIRMING" || payment.status === "PARTIAL";
  const qr = payment.payAddress ? await QRCode.toDataURL(payment.payAddress, { margin: 1, width: 240, color: { dark: "#06140f", light: "#f6f1e7" } }) : null;

  return (
    <div className="container-page max-w-lg py-10">
      {open && <AutoRefresh />}
      <div className="card space-y-5">
        <div>
          <p className="muted text-sm">{payment.plan.name} · {usd(payment.amountCents)}</p>
          <h1 className="mt-1 text-2xl">Send exactly {payment.payAmount} {payment.currency}</h1>
          <p className="mt-1 text-sm text-gold-300">{networkNote[payment.network]}</p>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Payment address QR code" className="mx-auto h-56 w-56 rounded-xl" />
        )}
        <div>
          <p className="label">Address</p>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-turf-950/60 p-3">
            <code className="min-w-0 flex-1 break-all text-xs">{payment.payAddress}</code>
            {payment.payAddress && <CopyButton value={payment.payAddress} />}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm">
          <span>Status</span>
          <span className="font-semibold">
            {payment.status === "PENDING" && "Waiting for payment…"}
            {payment.status === "CONFIRMING" && "Confirming on-chain…"}
            {payment.status === "PARTIAL" && "Partially paid, send the rest"}
            {payment.status === "EXPIRED" && "Expired"}
            {payment.status === "FAILED" && "Failed"}
          </span>
        </div>
        {payment.expiresAt && open && <p className="muted text-xs">This address is valid until {dateTime(payment.expiresAt)}. This page updates by itself.</p>}
        {!open && <Link href={`/checkout/${payment.plan.slug}`} className="btn-gold w-full">Start a new payment</Link>}
        {payment.provider === "mock" && open && (
          <form action={simulatePayment} className="rounded-xl border border-dashed border-gold-400/40 p-3">
            <input type="hidden" name="id" value={payment.id} />
            <p className="muted mb-2 text-xs">Test mode: no real crypto is moved.</p>
            <button className="btn-ghost w-full">Simulate a confirmed payment</button>
          </form>
        )}
      </div>
    </div>
  );
}
