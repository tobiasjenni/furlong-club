import { beforeEach, expect, it, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { signAdminConfirmation, ADMIN_COOKIE } from "@/lib/admin-session";

const store = new Map<string, string>();
let account: { id: string; role: string; status: string; sessionVersion: number };
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => store.has(key) ? { value: store.get(key) } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async () => account } } }));
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { reviewManualDeposit } from "@/app/actions/wallet";

beforeEach(async () => {
  process.env.AUTH_SECRET = "t".repeat(40);
  account = { id: "owner", role: "SUPER_ADMIN", status: "ACTIVE", sessionVersion: 1 };
  store.clear();
  store.set(SESSION_COOKIE, await signSession({ uid: account.id, role: "SUPER_ADMIN", sv: 1 }));
});
it("requires confirmation inside the admin action, even when called without the page", async () => {
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin-unlock");
  await expect(reviewManualDeposit(null, new FormData())).rejects.toThrow("REDIRECT:/admin-unlock");
});
it("allows a current confirmed admin and rejects a revoked session or changed role", async () => {
  store.set(ADMIN_COOKIE, await signAdminConfirmation(account, store.get(SESSION_COOKIE)!));
  expect(await requireSuperAdmin()).toBe(account);
  account.sessionVersion++;
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  account.sessionVersion = 1; account.role = "USER";
  await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
});
