import { describe, expect, it } from "vitest";
import { allocationScenario } from "@/lib/allocation-planner";

describe("the illustrative 28-day planner supports larger total-period returns", () => {
  it("calculates the requested 50%, 100% and 150% presets as profit plus principal", () => {
    expect(allocationScenario("1000", "50")).toEqual({ principalCents:100000, percent:50, profitCents:50000, totalCents:150000 });
    expect(allocationScenario("1000", "100")?.totalCents).toBe(200000);
    expect(allocationScenario("1000", "150")?.totalCents).toBe(250000);
  });
  it("allows higher finite positive scenarios without imposing a 100% ceiling", () => {
    expect(allocationScenario("500", "500")?.totalCents).toBe(300000);
    expect(allocationScenario("1000", "10000")?.totalCents).toBe(10100000);
  });
  it("keeps break-even, partial loss and complete loss calculations correct", () => {
    expect(allocationScenario("1000", "0")?.totalCents).toBe(100000);
    expect(allocationScenario("1000", "-25")?.totalCents).toBe(75000);
    expect(allocationScenario("1000", "-100")?.totalCents).toBe(0);
    expect(allocationScenario("1000", "-100.1")).toBeNull();
  });
  it("rejects malformed amounts, non-finite returns and precision overflow", () => {
    for (const amount of ["", "499.99", "10000.01", "500.001", "1e3"]) expect(allocationScenario(amount, "150")).toBeNull();
    for (const rate of ["", " ", "Infinity", "NaN", "not a number", "1e308", "1e20"]) expect(allocationScenario("1000", rate)).toBeNull();
    expect(allocationScenario("500.01", "150")?.profitCents).toBe(75002);
  });
});
