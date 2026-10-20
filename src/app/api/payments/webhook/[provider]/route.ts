import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getProvider, reconcilePayment } from "@/lib/payments";
import { db } from "@/lib/db";

const MAX_BODY = 64 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  if (name === "mock") return NextResponse.json({ error: "not found" }, { status: 404 });
  let provider;
  try {
    provider = getProvider(name);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });
  const event = await provider.parseWebhook(raw, req.headers);
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const payment = await db.payment.findUnique({ where: { provider_providerRef: { provider: name, providerRef: event.providerRef } } });
  if (!payment) return NextResponse.json({ error: "invoice not ready, retry" }, { status: 503 });
  const key = crypto.createHash("sha256").update(raw).digest("hex");
  // Retain the signed notification even if the status API is temporarily unavailable.
  await db.$executeRaw`INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
    VALUES (${`${payment.id}:ipn:${key}`},${payment.id},${`ipn:${key}`},'signed-ipn',${raw}::jsonb,'notification received')
    ON CONFLICT ("paymentId","eventKey") DO NOTHING`;
  try { await reconcilePayment(payment, "webhook-status-api"); }
  catch { return NextResponse.json({ error: "status unavailable, retry" }, { status: 503 }); }
  return NextResponse.json({ ok: true });
}
