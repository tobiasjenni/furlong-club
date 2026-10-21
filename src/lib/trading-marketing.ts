// Owner-proposed marketing targets only. Not contractual rates or recorded results.
export const proposedTradingTargets = {
  form: { name: "Form Room", range: "1–3%" },
  "inner-circle": { name: "Inner Circle", range: "2–4%" },
} as const;

export function proposedTargetFor(slug?: string) {
  return slug === "form" || slug === "inner-circle" ? proposedTradingTargets[slug] : null;
}
