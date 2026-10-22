import { afterEach, expect, it, vi } from "vitest";
import { emailVerificationRequired, memberEmailReady } from "../src/lib/email-verification";
afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "true", "", "invalid"])("requires confirmation unless explicitly paused: %s", value => {
  vi.stubEnv("EMAIL_VERIFICATION_REQUIRED", value);
  expect(emailVerificationRequired()).toBe(true);
  expect(memberEmailReady(null)).toBe(false);
  expect(memberEmailReady(new Date())).toBe(true);
});
it("allows ordinary members while preserving the real unconfirmed status", () => {
  vi.stubEnv("EMAIL_VERIFICATION_REQUIRED", "false");
  expect(emailVerificationRequired()).toBe(false);
  expect(memberEmailReady(null)).toBe(true);
});
