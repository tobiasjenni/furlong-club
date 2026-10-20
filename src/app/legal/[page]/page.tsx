import { notFound } from "next/navigation";
import { brand } from "@/lib/config";

// Placeholder copy. Replace with text reviewed by your lawyers before launch.
const pages: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of service",
    body: [
      `${brand.name} provides horse racing education and opinion videos. Content is for information and entertainment and is not financial, investment or betting advice.`,
      "You must be 18 or over, and of legal age to gamble where you live, to use the service.",
      "Subscriptions are paid in advance in stablecoins and run for the stated period. Crypto payments are final once confirmed on-chain.",
      `${brand.name} does not place bets on your behalf and does not hold funds for betting.`,
      "Rob is a fictional character used as the brand mascot.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We store your name, email, optional country, login times and payment records to run your account.",
      "We do not sell your data. Marketing emails are only sent if you opt in, and you can opt out at any time from your account page.",
      `To request a copy or deletion of your data, email ${brand.supportEmail}.`,
    ],
  },
  "responsible-gambling": {
    title: "Responsible gambling",
    body: [
      "Only bet money you can afford to lose. Set limits before you start and stick to them.",
      "Never chase losses, and never bet to pay bills or debts.",
      "If gambling stops being fun, take a break. In the UK, GamCare (0808 8020 133) and BeGambleAware.org offer free, confidential help. GAMSTOP lets you self-exclude from UK-licensed operators.",
      `If you would like us to close your ${brand.name} account, email ${brand.supportEmail}.`,
    ],
  },
};

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
