import { afterEach, describe, expect, it, vi } from "vitest";
import { walletTestMode } from "@/lib/environment";

describe("deployed wallet simulation gate", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("requires all three explicit test settings", () => {
    vi.stubEnv("APP_ENV", "staging"); vi.stubEnv("PAYMENT_PROVIDER", "mock"); vi.stubEnv("ENABLE_TEST_PAYMENTS", "true");
    expect(walletTestMode()).toBe(true);
  });
  it.each([
    ["production", "mock", "true"], ["staging", "nowpayments", "true"], ["staging", "mock", "false"],
    ["", "mock", "true"], ["staging", "mock", ""],
  ])("keeps simulation disabled for %s / %s / %s", (env, provider, enabled) => {
    vi.stubEnv("APP_ENV", env); vi.stubEnv("PAYMENT_PROVIDER", provider); vi.stubEnv("ENABLE_TEST_PAYMENTS", enabled);
    expect(walletTestMode()).toBe(false);
  });
});
