import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { send, context } = vi.hoisted(() => {
  const send = vi.fn();
  return { send, context: vi.fn(() => ({ env: { EMAIL: { send } } })) };
});
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: context }));
import { emailDelivers, sendEmail, verifyEmailMessage, resetPasswordMessage } from "@/lib/email";
const message = { to: "member@example.com", subject: "Confirm email", html: "<p>Confirm</p>", text: "Confirm" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("EMAIL_PROVIDER", "cloudflare"); vi.stubEnv("EMAIL_FROM_ADDRESS", "notifications@furlong.club"); send.mockResolvedValue({ messageId: "test" }); context.mockReturnValue({ env: { EMAIL: { send } } }); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(["", "production"])("never logs emails in CI or an unconfigured maintenance process: %s", async mode => {
  vi.stubEnv("EMAIL_PROVIDER", "console"); vi.stubEnv("NODE_ENV", mode); vi.stubEnv("CI", "true");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await expect(sendEmail({ ...message, text: "private recovery token" })).rejects.toThrow("not configured");
    expect(log).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
it("sends HTML and text through Cloudflare with the support reply address", async () => {
  expect(emailDelivers()).toBe(true);
  await sendEmail(message);
  expect(send).toHaveBeenCalledWith({ ...message, from: { email: "notifications@furlong.club", name: "Furlong Club" }, replyTo: "support@furlong.club" });
});
it("fails closed when the binding is missing", async () => {
  context.mockReturnValue({ env: {} } as ReturnType<typeof context>);
  await expect(sendEmail(message)).rejects.toThrow("binding is missing");
});
it("propagates recipient rejection without retrying", async () => {
  send.mockRejectedValue(Object.assign(new Error("Suppressed"), { code: "E_RECIPIENT_SUPPRESSED" }));
  await expect(sendEmail(message)).rejects.toThrow("Suppressed");
  expect(send).toHaveBeenCalledTimes(1);
});
it("bounds retries for explicit temporary rate limit rejections", async () => {
  vi.useFakeTimers();
  send.mockRejectedValueOnce(Object.assign(new Error("Rate limited"), { code: "E_RATE_LIMIT_EXCEEDED" }));
  const pending = sendEmail(message);
  await vi.runAllTimersAsync(); await pending;
  expect(send).toHaveBeenCalledTimes(2);
});
it("does not report console or an unconfigured Resend provider as delivering", () => {
  vi.stubEnv("EMAIL_PROVIDER", "console"); expect(emailDelivers()).toBe(false);
  vi.stubEnv("EMAIL_PROVIDER", "resend"); vi.stubEnv("RESEND_API_KEY", ""); expect(emailDelivers()).toBe(false);
});
it("retains the verification and recovery links in both email formats", () => {
  for (const [message, path] of [[verifyEmailMessage("member@example.com", "test-token"), "verify-email"], [resetPasswordMessage("member@example.com", "test-token"), "reset-password"]] as const) {
    expect(message.text).toContain(`/${path}?token=test-token`);
    expect(message.html).toContain(`/${path}?token=test-token`);
  }
});
