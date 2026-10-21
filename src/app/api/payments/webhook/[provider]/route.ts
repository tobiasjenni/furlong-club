import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getProvider, reconcilePayment } from "@/lib/payments";
import { db } from "@/lib/db";
import { BodyLimitError, limitedText } from "@/lib/http-body";

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
  let raw: string;
  try { raw = await limitedText(req, MAX_BODY); }
  catch (error) { return NextResponse.json({ error: error instanceof BodyLimitError ? "too large" : "invalid body" }, { status: error instanceof BodyLimitError ? 413 : 400 }); }
  let event;
  try { event = await provider.parseWebhook(raw, req.headers); }
  catch { return NextResponse.json({ error: "invalid notification" }, { status: 400 }); }
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
