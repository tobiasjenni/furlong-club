import { describe, expect, it } from "vitest";
import { adminNavigation, isAdminWorkspacePath, memberNavigation, workspaceLinkActive } from "@/lib/workspace-navigation";

describe("shared workspace navigation", () => {
  it("highlights exactly the relevant admin section on nested record pages", () => {
    for (const [path, expected] of [["/admin", "/admin"], ["/admin/users/member-id", "/admin/users"], ["/admin/payments/payment-id", "/admin/payments"], ["/admin/trading/allocation-id", "/admin/trading"]]) {
      expect(adminNavigation.filter(link => workspaceLinkActive(path, link.href)).map(link => link.href)).toEqual([expected]);
    }
  });
  it("does not classify public pages or admin authentication as the authorized back office", () => {
    for (const path of ["/", "/administrator", "/admin-unlock", "/admin-unlock/security", "/login"]) expect(isAdminWorkspacePath(path)).toBe(false);
    expect(isAdminWorkspacePath("/admin")).toBe(true);
    expect(isAdminWorkspacePath("/admin/users")).toBe(true);
  });
  it("keeps all existing member and admin destinations available without adding staff routes to member navigation", () => {
    expect(adminNavigation).toHaveLength(12);
    expect(memberNavigation).toHaveLength(10);
    expect(memberNavigation.some(link => link.href.startsWith("/admin"))).toBe(false);
    expect(new Set(adminNavigation.map(link => link.href)).size).toBe(12);
    expect(memberNavigation.filter(link => workspaceLinkActive("/deposits/receipt", link.href))).toHaveLength(0);
  });
});
