import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ delivers: vi.fn(), send: vi.fn(), subscriptions: vi.fn(), update: vi.fn(), execute: vi.fn(), expire: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { subscription: { findMany: mocks.subscriptions, update: mocks.update }, $executeRaw: mocks.execute } }));
vi.mock("@/lib/email", () => ({ emailDelivers: mocks.delivers, sendEmail: mocks.send, renewalReminderMessage: (to: string) => ({ to, text: "private message" }) }));
vi.mock("@/lib/payments", () => ({ expireStalePayments: mocks.expire }));
import { runDailyJobs } from "@/lib/daily";
beforeEach(() => { vi.clearAllMocks(); mocks.execute.mockResolvedValue(0); mocks.expire.mockResolvedValue({ count: 0 }); });

it("does not fetch customer email or mark reminders sent without a delivery provider", async () => {
  mocks.delivers.mockReturnValue(false);
  expect(await runDailyJobs()).toMatchObject({ reminded: 0, remindersAvailable: false });
  expect(mocks.subscriptions).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.expire).toHaveBeenCalledOnce();
});
it("keeps failed delivery details and recipient information out of operational logs", async () => {
  mocks.delivers.mockReturnValue(true);
  mocks.subscriptions.mockResolvedValue([{ id: "subscription-reference", user: { email: "private@example.com" }, plan: { name: "Form Room", slug: "form" }, endsAt: new Date() }]);
  mocks.send.mockRejectedValue(new Error("private@example.com credential-token confidential-provider-response"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await runDailyJobs()).toMatchObject({ reminded: 0, remindersAvailable: true });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example|credential-token|confidential-provider/);
    expect(mocks.update).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
