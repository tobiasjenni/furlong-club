import { describe, expect, it } from "vitest";
import { allocationCapacity, allocationRequestHref, defaultAllocationAmount, fundingCents } from "@/lib/member-funding";
import { isClubReceivingAddress, normalizePayoutAddress, payoutDestinationError } from "@/lib/payout-address";

const eth = "0x52908400098527886E0F7030069857D2E4169EE7";
const other = "0xde709f2102306220921060314715629080e2fb77";
const tron = "TPGPga3MfPrFThgFeGnBrfQN4aRCMPH5mf";

describe("funding handoff respects credit and allocation limits", () => {
  it("parses cents exactly and rejects malformed or excessive query input", () => {
    expect(fundingCents("500.01")).toBe(50001);
    for (const value of ["", "-500", "5e2", "500.001", "Infinity", "10000000", "500 USD"]) expect(fundingCents(value)).toBeNull();
  });
  it("caps a prefilled deposit amount by available credit and already committed principal", () => {
    expect(allocationCapacity(200000, 900000)).toBe(100000);
    expect(defaultAllocationAmount(200000, 900000, "2500")).toBe("1000");
    expect(defaultAllocationAmount(50001, 0, "1000")).toBe("500.01");
    expect(defaultAllocationAmount(200000, 0, "-1")).toBe("500");
    expect(defaultAllocationAmount(200000, 0, "20")).toBe("500");
    expect(allocationCapacity(100000, 1000000)).toBe(0);
    expect(allocationCapacity(100000, 1100000)).toBe(0);
  });
  it("prefills a safe amount and payout route without propagating the club address", () => {
    const href = allocationRequestHref(50001, "USDC", "ERC20");
    expect(href).toBe("/allocations?amount=500.01&currency=USDC&network=ERC20#request");
    expect(allocationRequestHref(1)).toContain("amount=500.00");
    expect(allocationRequestHref(2000000)).toContain("amount=10000.00");
    expect(href).not.toContain("address");
  });
});

describe("early personal payout wallet checks", () => {
  it("validates Ethereum and Tron checksums identically in browser and server code", () => {
    expect(normalizePayoutAddress("ERC20", eth)).toBe(eth);
    expect(normalizePayoutAddress("ERC20", eth.toLowerCase())).toBe(eth);
    expect(normalizePayoutAddress("ERC20", eth.replace("E0F", "e0F"))).toBeNull();
    expect(normalizePayoutAddress("TRC20", tron)).toBe(tron);
    expect(normalizePayoutAddress("TRC20", tron.slice(0, -1) + "g")).toBeNull();
    expect(normalizePayoutAddress("ERC20", "0x" + "0".repeat(40))).toBeNull();
    expect(normalizePayoutAddress("POLYGON", eth)).toBeNull();
  });
  it("blocks every configured club address on the same chain even after a token change", () => {
    const clubs = [{ network: "ERC20", address: eth }, { network: "ERC20", address: other }, { network: "TRC20", address: tron }];
    expect(isClubReceivingAddress("ERC20", eth.toLowerCase(), clubs)).toBe(true);
    expect(isClubReceivingAddress("ERC20", other, clubs)).toBe(true);
    expect(payoutDestinationError("ERC20", eth, eth, clubs)).toContain("club’s deposit address");
    expect(payoutDestinationError("TRC20", tron, tron, clubs)).toContain("choose Receive");
    expect(isClubReceivingAddress("TRC20", tron.toLowerCase(), clubs)).toBe(false);
  });
  it("catches mismatched wallets and wrong networks before consent, and accepts a valid destination", () => {
    expect(payoutDestinationError("ERC20", eth, other, [])).toContain("do not match");
    expect(payoutDestinationError("ERC20", tron, tron, [])).toContain("Ethereum");
    expect(payoutDestinationError("TRC20", eth, eth, [])).toContain("Tron");
    expect(payoutDestinationError("ERC20", eth, eth.toLowerCase(), [])).toBeNull();
    expect(payoutDestinationError("TRC20", tron, tron, [])).toBeNull();
  });
});
