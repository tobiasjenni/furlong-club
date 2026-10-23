import { beforeEach, expect, it, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { signAdminConfirmation, ADMIN_COOKIE } from "@/lib/admin-session";

const store = new Map<string, string>();
let account: { id: string; role: string; status: string; sessionVersion: number };
let notificationQueries = 0;
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => store.has(key) ? { value: store.get(key) } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async () => account }, $queryRaw: async () => { notificationQueries++; return [{ deposits: 2, pending: 3, due: 4 }]; } } }));
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { reviewManualDeposit } from "@/app/actions/wallet";
import { refreshAdminPayment } from "@/app/actions/wallet";
import { addNote, updateUser, grantPlan, cancelSubscription, saveVideo, deleteVideo, savePlan, signOutUser, changeUserRole, confirmEmail, sendResetLink, editUserProfile, deleteUserAccount, permanentlyDeleteUser } from "@/app/actions/admin";
import { manageTrading } from "@/app/actions/trading";
import { GET as notifications } from "@/app/api/admin/notifications/route";
import { saveDailyResult, saveCycleSummary } from "@/app/actions/daily-results";

beforeEach(async () => {
  process.env.AUTH_SECRET = "t".repeat(40);
  notificationQueries = 0;
  account = { id: "owner", role: "SUPER_ADMIN", status: "ACTIVE", sessionVersion: 1 };
  store.clear();
  store.set(SESSION_COOKIE, await signSession({ uid: account.id, role: "SUPER_ADMIN", sv: 1 }));
});
it("protects combined admin notifications with the current role, second factor and session version", async () => {
  expect((await notifications()).status).toBe(403); expect(notificationQueries).toBe(0);
  store.set(ADMIN_COOKIE, await signAdminConfirmation(account, store.get(SESSION_COOKIE)!, "passkey"));
  const response = await notifications(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ deposits: 2, pending: 3, due: 4 }); expect(notificationQueries).toBe(1);
  account.role = "USER"; expect((await notifications()).status).toBe(403);
  account.role = "SUPER_ADMIN"; account.sessionVersion++; expect((await notifications()).status).toBe(403);
  expect(notificationQueries).toBe(1);
});
it("requires confirmation inside the admin action, even when called without the page", async () => {
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin-unlock");
  await expect(reviewManualDeposit(null, new FormData())).rejects.toThrow("REDIRECT:/admin-unlock");
});
it("allows a current confirmed admin and rejects a revoked session or changed role", async () => {
  store.set(ADMIN_COOKIE, await signAdminConfirmation(account, store.get(SESSION_COOKIE)!, "passkey"));
  expect(await requireSuperAdmin()).toBe(account);
  account.sessionVersion++;
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  account.sessionVersion = 1; account.role = "USER";
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
});
it("lets a confirmed Admin read but blocks every back-office write before accessing data", async () => {
  account.role = "ADMIN";
  store.set(SESSION_COOKIE, await signSession({ uid: account.id, role: "ADMIN", sv: 1 }));
  store.set(ADMIN_COOKIE, await signAdminConfirmation(account, store.get(SESSION_COOKIE)!, "passkey"));
  expect(await requireAdmin()).toBe(account); expect((await notifications()).status).toBe(200);
  for (const action of [addNote, updateUser, grantPlan, cancelSubscription, saveVideo, deleteVideo, savePlan, signOutUser, confirmEmail, refreshAdminPayment]) await expect(action(new FormData())).rejects.toThrow("REDIRECT:/admin");
  for (const action of [reviewManualDeposit, manageTrading, changeUserRole, sendResetLink, editUserProfile, deleteUserAccount, permanentlyDeleteUser, saveDailyResult, saveCycleSummary]) await expect(action(null, new FormData())).rejects.toThrow("REDIRECT:/admin");
  expect(notificationQueries).toBe(1);
});
