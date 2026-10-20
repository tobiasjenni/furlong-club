import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { sortKeys, verifyNowPaymentsSignature } from "@/lib/payments/nowpayments";
import { safeNext } from "@/lib/request";
import { signSession, verifySession } from "@/lib/session";
import { bunnyEmbedUrl } from "@/lib/video";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/videos/abc")).toBe("/videos/abc");
  });
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", undefined])("rejects %s", (v) => {
    expect(safeNext(v)).toBe("/dashboard");
  });
});

describe("NOWPayments IPN signature", () => {
  const secret = "ipn-secret";
  const body = { payment_status: "finished", payment_id: 42, order_id: "abc", price_amount: 29 };
  const sign = (b: object) => crypto.createHmac("sha512", secret).update(JSON.stringify(sortKeys(b))).digest("hex");

  it("accepts a valid signature regardless of key order", () => {
    const raw = JSON.stringify({ price_amount: 29, order_id: "abc", payment_id: 42, payment_status: "finished" });
    expect(verifyNowPaymentsSignature(raw, sign(body), secret)).toMatchObject({ order_id: "abc" });
  });
  it("rejects a tampered body", () => {
    const raw = JSON.stringify({ ...body, price_amount: 1 });
    expect(verifyNowPaymentsSignature(raw, sign(body), secret)).toBeNull();
  });
  it("rejects missing signatures and bad JSON", () => {
    expect(verifyNowPaymentsSignature(JSON.stringify(body), null, secret)).toBeNull();
    expect(verifyNowPaymentsSignature("{not json", sign(body), secret)).toBeNull();
  });
});

describe("session tokens", () => {
  process.env.AUTH_SECRET = "x".repeat(40);
  it("round-trips the session version", async () => {
    const token = await signSession({ uid: "u1", role: "USER", sv: 3 });
    expect(await verifySession(token)).toEqual({ uid: "u1", role: "USER", sv: 3 });
  });
  it("rejects tokens signed with another secret", async () => {
    const token = await signSession({ uid: "u1", role: "ADMIN", sv: 0 });
    process.env.AUTH_SECRET = "y".repeat(40);
    expect(await verifySession(token)).toBeNull();
    process.env.AUTH_SECRET = "x".repeat(40);
  });
  it("rejects garbage", async () => {
    expect(await verifySession("abc.def.ghi")).toBeNull();
  });
});

describe("Bunny embed token", () => {
  it("signs sha256(key + videoId + expires)", () => {
    const now = 1_700_000_000_000;
    const url = new URL(bunnyEmbedUrl("vid-1", "123", "key", 3600, now));
    const expires = String(now / 1000 + 3600);
    expect(url.searchParams.get("expires")).toBe(expires);
    expect(url.searchParams.get("token")).toBe(crypto.createHash("sha256").update("key" + "vid-1" + expires).digest("hex"));
    expect(url.pathname).toBe("/embed/123/vid-1");
  });
});
