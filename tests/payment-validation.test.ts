import { describe, expect, it, vi, afterEach } from "vitest";
import { decimal, validatePaymentEvent } from "@/lib/payments/validation";
import { nowPaymentsProvider, parseNowPayment, parseProviderJson, verifyNowPaymentsSignature } from "@/lib/payments/nowpayments";
import type { WebhookEvent } from "@/lib/payments/types";

const p = { id: "internal", providerRef: "123", currency: "USDC", network: "POLYGON", amountCents: 5000,
  payAddress: "0x1111111111111111111111111111111111111111", payAmount: "50.123456", poolAddress: "0x2222222222222222222222222222222222222222" };
const valid: WebhookEvent = { providerRef: "123", orderId: "internal", status: "CONFIRMED", providerStatus: "finished",
  priceAmount: "50", priceCurrency: "usd", payCurrency: "usdcmatic", payAddress: p.payAddress,
  quotedAmount: p.payAmount, receivedAmount: p.payAmount, outcomeAmount: "49.5", outcomeCurrency: "usdcmatic", payoutHash: "tx-payout" };

describe("strict stablecoin validation", () => {
  it("requires a fully paid and completed settlement", () => { expect(validatePaymentEvent(p, valid)).toBeNull(); });
  it.each([
    { orderId: undefined }, { providerRef: "456" }, { priceAmount: "NaN" }, { priceAmount: "49.99" },
    { priceCurrency: "eur" }, { payCurrency: "usdc" }, { payAddress: "wrong" }, { quotedAmount: "50" },
    { receivedAmount: undefined }, { receivedAmount: "50.123455" }, { providerStatus: "confirmed" },
    { outcomeCurrency: "trx" }, { outcomeAmount: "0" }, { payoutHash: undefined }, { payoutAddress: "wrong" },
  ])("fails closed on %j", extra => { expect(validatePaymentEvent(p, { ...valid, ...extra })).not.toBeNull(); });
  it("does not accept the former 0.5 percent underpayment tolerance", () => {
    expect(validatePaymentEvent({ ...p, payAmount: "100" }, { ...valid, quotedAmount: "100", receivedAmount: "99.99" })).not.toBeNull();
  });
  it("supports exact decimal overpayment without silently increasing the USD quote", () => {
    expect(validatePaymentEvent(p, { ...valid, receivedAmount: "50.123457" })).toBeNull();
    expect(decimal("50.123457")!.minus("50.123456").toFixed()).toBe("0.000001");
  });
  it.each([null, undefined, "NaN", "Infinity", "-1", "1e30", "", "0.1234567890123456789"])("rejects malformed amount %j", value => expect(decimal(value)).toBeNull());
  it("retains up to 18 decimal places exactly", () => expect(decimal("1.123456789012345678")?.toFixed()).toBe("1.123456789012345678"));
  it("preserves quantities and large references from the provider's original JSON", () => {
    const parsed = parseNowPayment(parseProviderJson('{"payment_id":123456789012345678,"payment_status":"finished","actually_paid":123456.123456789012345678}'));
    expect(parsed?.providerRef).toBe("123456789012345678");
    expect(parsed?.receivedAmount).toBe("123456.123456789012345678");
  });
  it("does not treat incoming confirmed status as payment completion", () => {
    expect(parseNowPayment({ payment_id: 123, payment_status: "confirmed" })?.status).toBe("CONFIRMING");
    expect(parseNowPayment({ payment_id: 123, payment_status: "finished" })?.status).toBe("CONFIRMED");
  });
  it("handles signed null/array JSON without throwing", () => {
    expect(verifyNowPaymentsSignature("null", "x", "secret")).toBeNull();
    expect(verifyNowPaymentsSignature("[]", "x", "secret")).toBeNull();
  });
});

describe("provider invoice routing", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("routes to the configured pooled address in the same token/network", async () => {
    vi.stubEnv("NOWPAYMENTS_API_KEY", "test"); vi.stubEnv("NOWPAYMENTS_IPN_SECRET", "test");
    const request = vi.fn().mockResolvedValueOnce(Response.json({ currencies: ["usdcmatic"] }))
      .mockResolvedValueOnce(Response.json({ payment_id: 123, pay_address: p.payAddress, pay_amount: 50, order_id: "internal", price_amount: 50, price_currency: "usd", pay_currency: "usdcmatic" }));
    vi.stubGlobal("fetch", request);
    await nowPaymentsProvider().createInvoice({ paymentId: "internal", amountUsd: 50, currency: "USDC", network: "POLYGON", description: "top-up", callbackUrl: "https://example.com/ipn", poolAddress: p.poolAddress });
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ payout_address: p.poolAddress, payout_currency: "usdcmatic", pay_currency: "usdcmatic", order_id: "internal" });
  });
});
