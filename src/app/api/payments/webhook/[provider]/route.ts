import { NextResponse } from "next/server";
import { applyPaymentStatus, getProvider } from "@/lib/payments";

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
  await applyPaymentStatus(provider.name, event);
  return NextResponse.json({ ok: true });
}
