import { expect, it } from "vitest";
import { membershipFundingAmount, membershipReturnPath } from "../src/lib/membership-funding";
it.each(["/membership/form", "/membership/inner-circle"])("retains the selected membership destination: %s", path => {
  expect(membershipReturnPath(path)).toBe(path);
});
it.each(["https://evil.invalid", "//evil.invalid", "/admin", "/membership/form?next=//evil.invalid", "/membership/../admin", "/membership/form#bad", null, {path:"/membership/form"}])("rejects an unrelated or unsafe return hint: %s", path => {
  expect(membershipReturnPath(path)).toBeNull();
});
it("suggests the membership shortfall within the supported deposit limits", () => {
  expect(membershipFundingAmount(2900, 0)).toBe(29);
  expect(membershipFundingAmount(7900, 0)).toBe(79);
  expect(membershipFundingAmount(2900, 1200)).toBe(20);
  expect(membershipFundingAmount(2900, 2900)).toBe(20);
  expect(membershipFundingAmount(2000000, 0)).toBe(10000);
});
