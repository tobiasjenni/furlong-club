import Link from "next/link";
import { tradingJourney } from "@/lib/trading-journey";

export function TradingNextStep(props: Parameters<typeof tradingJourney>[0]) {
  const next = tradingJourney(props);
  return <section className="portal-panel portal-next-step" aria-label="Your next trading step">
    <div className="portal-next-step-copy"><p className="portal-eyebrow">YOUR NEXT STEP</p><h2>{next.title}</h2><p className="portal-lead">{next.description}</p></div>
    <Link prefetch={false} href={next.href} className="btn-gold">{next.action}<span aria-hidden="true"> →</span></Link>
    <ol className="portal-journey-steps" aria-label="Trading journey">{["Fund your wallet", "Request your entry", "Follow the trading period", "Track manual payout"].map((label, index) => <li key={label} aria-current={next.stage === index ? "step" : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{label}</li>)}</ol>
  </section>;
}
