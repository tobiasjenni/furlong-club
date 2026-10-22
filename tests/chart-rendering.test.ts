import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountChart } from "../src/components/v2/AccountChart";

afterEach(() => vi.restoreAllMocks());

it.each([
  { metric: "value" as const, value: 2000, profit: 0, results: 0, tooltip: "2026-10-22: $20.00" },
  { metric: "profit" as const, value: 1900, profit: -100, results: 1, tooltip: "2026-10-22: -$1.00" },
])("server-renders a $metric chart without invalid title children", ({ metric, value, profit, results, tooltip }) => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const html = renderToStaticMarkup(createElement(AccountChart, {
    points: [{ day: "2026-10-22", valueCents: value, profitCents: profit, dailyProfitCents: profit, resultCount: results }],
    results, reconciled: true, initialMetric: metric,
  }));
  expect(errors).not.toHaveBeenCalled();
  expect(html).toContain(`<title>${tooltip}</title>`);
});

it("renders a useful empty chart before the first financial entry", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const html = renderToStaticMarkup(createElement(AccountChart, { points: [], results: 0, reconciled: true }));
  expect(html).toContain("Your account-value history will appear after your first confirmed financial entry.");
  expect(errors).not.toHaveBeenCalled();
});
