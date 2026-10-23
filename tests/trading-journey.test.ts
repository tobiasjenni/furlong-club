import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tradingJourney } from "@/lib/trading-journey";
import { TradingNextStep } from "@/components/v2/TradingNextStep";

const defaults = { snapshot: { availableCents: 0, pendingCount: 0, activeCount: 0, payoutDueCents: 0, pendingDepositCount: 0 }, deposit: null, frozen: false, emailReady: true, accepting: true };
function journey(snapshot = {}, rest = {}) { return tradingJourney({ ...defaults, ...rest, snapshot: { ...defaults.snapshot, ...snapshot } }); }

describe("the member’s next step follows their actual funding state", () => {
  it("guides a new free member to the allocation funding route without a subscription", () => {
    const step = journey();
    expect(step.href).toBe("/wallet?for=trading#add-funds"); expect(step.description).toContain("$500.00 more"); expect(step.stage).toBe(0);
  });
  it("shows the funding shortfall instead of treating partial approved credit as ready", () => {
    expect(journey({ availableCents: 40000 }).description).toContain("$100.00 more");
    expect(journey({ availableCents: 49999 }).stage).toBe(0);
    expect(journey({ availableCents: 50000 }).href).toBe("/allocations#request");
  });
  it("opens an existing unsent receipt rather than encouraging another deposit", () => {
    const step = journey({ pendingDepositCount: 1 }, { deposit: { id: "deposit-1", status: "PENDING" } });
    expect(step.href).toBe("/deposits/deposit-1"); expect(step.description).toContain("report the transaction ID"); expect(step.description).toContain("do not send it again");
  });
  it("tells a member with a reported deposit to wait for verification", () => {
    const step = journey({ pendingDepositCount: 1 }, { deposit: { id: "deposit-2", status: "CONFIRMING" } });
    expect(step.action).toBe("Track your deposit"); expect(step.stage).toBe(0); expect(step.description).toContain("Do not send the same payment again");
  });
  it("handles a snapshot and receipt query changing during an approval", () => {
    expect(journey({ pendingDepositCount: 1 }).href).toBe("/wallet");
    expect(journey({ availableCents: 50000, pendingDepositCount: 1 }, { deposit: { id: "extra", status: "CONFIRMING" } }).href).toBe("/allocations#request");
  });
  it("distinguishes an allocation request from a fund reservation", () => {
    const step = journey({ availableCents: 50000, pendingCount: 1 });
    expect(step.href).toBe("/allocations#allocations"); expect(step.description).toContain("does not reserve funds"); expect(step.action).toBe("Review your request");
  });
  it("keeps existing approved allocations visible when new enrollment is paused", () => {
    const step = journey({ activeCount: 1 }, { accepting: false });
    expect(step.stage).toBe(2); expect(step.description).toContain("original dates"); expect(step.action).toBe("View your allocation");
  });
  it("tracks a recorded payout without presenting it as already sent", () => {
    const step = journey({ activeCount: 1, payoutDueCents: 75000 });
    expect(step.stage).toBe(3); expect(step.title).toContain("awaiting payment"); expect(step.description).toContain("Maturity alone does not confirm payment");
  });
  it("does not send members to fund a new allocation when no entry is accepting", () => {
    expect(journey({}, { accepting: false }).href).toBe("/support");
    expect(journey({}, { accepting: false }).stage).toBe(-1);
  });
  it("prioritizes account restrictions over funding or allocation requests", () => {
    expect(journey({ availableCents: 50000, pendingCount: 1 }, { frozen: true }).href).toBe("/support");
    expect(journey({ availableCents: 50000 }, { emailReady: false }).href).toBe("/account");
  });
  it("renders one accessible current step and one direct action", () => {
    const html = renderToStaticMarkup(createElement(TradingNextStep, { ...defaults, snapshot: { ...defaults.snapshot, availableCents: 50000 } }));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1); expect(html).toContain('href="/allocations#request"');
    expect(html).toContain('aria-label="Trading journey"'); expect(html).toContain("Choose your entry");
  });
});
