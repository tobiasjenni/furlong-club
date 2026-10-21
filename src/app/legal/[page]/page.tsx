import { notFound } from "next/navigation";
import { brand } from "@/lib/config";

// Placeholder copy. Replace with text reviewed by your lawyers before launch.
const pages: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of service",
    body: [
      `${brand.name} provides horse racing education and opinion videos. Content is for information and entertainment and is not financial, investment or betting advice.`,
      "You must be 18 or over, and of legal age to gamble where you live, to use the service.",
      "Paid plans provide 33 days of access with a one-off payment and no automatic renewal. New access starts when the purchase is confirmed; buying the same active plan extends its current expiry. Approved deposits add USD club credit, which you can use to buy a plan. Blockchain transfers cannot be reversed by the site; contact support about payment errors, refund requests and any applicable statutory rights.",
      `${brand.name} does not place bets on your behalf and does not hold funds for betting.`,
      "Trading with Harry is a proposal with unfinished terms. Real trading enrollment is closed. The proposed 2–3% daily target is unverified and not guaranteed. Trading can lose some or all of the principal. The proposed 33-day lock begins on admin approval; any payout is based on actual recorded results and processed manually after maturity. No automated trading or payout is provided by this website.",
      `${brand.host.name} is the host of ${brand.name}. The current site portrait is an AI-generated illustration, not a photograph.`,
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We store your name, email, optional country, login times, payment records and any trading requests, accepted terms, payout addresses, results and transaction references to run your account. Financial records and audit history are retained when an account closes.",
      "We do not sell your data. Marketing emails are only sent if you opt in, and you can opt out at any time from your account page.",
      `To request a copy or deletion of your data, email ${brand.supportEmail}.`,
    ],
  },
  "responsible-gambling": {
    title: "Responsible gambling",
    body: [
      "Only bet money you can afford to lose. Set limits before you start and stick to them.",
      "Never chase losses, and never bet to pay bills or debts.",
      "If gambling is causing harm, take a break. In Great Britain, GamCare offers confidential support through the National Gambling Helpline on 0808 8020 133. GAMSTOP provides self-exclusion from gambling websites and apps run by businesses licensed in Great Britain.",
      `If you would like us to close your ${brand.name} account, email ${brand.supportEmail}.`,
    ],
  },
};

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  return { title: pages[(await params).page]?.title ?? "Not found" };
}

export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}

export default async function LegalPage({ params }: { params: Promise<{ page: string }> }) {
  const content = pages[(await params).page];
  if (!content) notFound();
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <h1 className="text-4xl">{content.title}</h1>
      <div className="mt-6 space-y-4 text-cream/80">
        {content.body.map((p) => <p key={p}>{p}</p>)}
      </div>
    </div>
  );
}
