import "./funding-flow.css";

export function FundingSteps({ step }: { step: 0 | 1 | 2 }) {
  return <ol className="funding-steps" aria-label="Add funds and trade">{["Add funds", "Deposit review", "Trade with Rob"].map((label, index) => <li key={label} className={`funding-step funding-step-${index}`} aria-current={step === index ? "step" : undefined}><span aria-hidden="true">{index < step ? "✓" : index + 1}</span><strong>{label}</strong></li>)}</ol>;
}
