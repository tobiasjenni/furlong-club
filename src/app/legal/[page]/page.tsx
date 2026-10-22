import { notFound } from "next/navigation";
import { brand } from "@/lib/config";
import { pageMetadata, type PublicPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { tradingTermsVersion } from "@/lib/trading";

// Placeholder copy. Replace with text reviewed by your lawyers before launch.
const pages: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of service",
    body: [
      `${brand.name} provides horse racing education and opinion videos. Content is for information and entertainment and is not financial, investment or betting advice.`,
      "You must be 18 or over, and of legal age to gamble where you live, to use the service.",
      "Paid plans provide 33 days of access with a one-off payment and no automatic renewal. New access starts when the purchase is confirmed; buying the same active plan extends its current expiry. Approved deposits add USD club credit, which you can use to buy a plan. Blockchain transfers cannot be reversed by the site; contact support about payment errors, refund requests and any applicable statutory rights.",
      "The website records manually verified stablecoin deposits, club credit and separately approved trading allocations. Deposits are received into the displayed club receiving wallets. It does not automatically execute trades, sign wallet transactions or send cryptocurrency. Harry and the club operator manage trading and transfers outside the website.",
      "Trading with Harry access is included in active Form Room and Inner Circle membership. Membership and the $500–$10,000 allocation are separate payments. Buying a membership or making a deposit does not create an allocation, start a lock or guarantee admission. Each allocation requires a separate request and Super Admin approval.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We store your name, email, optional country, login times, payment records and any trading requests, accepted terms, payout addresses, results and transaction references to run your account. Financial records and audit history are retained when an account closes.",
      "The private club entrance remembers an admitted public IP using a keyed fingerprint and admission time, rather than storing the raw address in the entrance record. This record lasts until removed or the club invitation changes. Devices sharing that public IP share entrance access; personal account login remains separate. A protected browser cookie remembers entrance for one year across network changes and is refreshed by personal sign-in. Existing members can always access sign-in and password recovery directly.",
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
  const page = (await params).page;
  if (!pages[page]) notFound();
  return pageMetadata(`/legal/${page}` as PublicPath);
}

export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}

export default async function LegalPage({ params }: { params: Promise<{ page: string }> }) {
  const page = (await params).page;
  const content = pages[page];
  if (!content) notFound();
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <Breadcrumbs path={`/legal/${page}`} label={content.title} />
      <h1 className="text-4xl">{content.title}</h1>
      <div className="mt-6 space-y-4 text-cream/80">
        {content.body.map((p) => <p key={p}>{p}</p>)}
      </div>
      {page === "terms" && <section id="trading-terms" className="mt-10 scroll-mt-24 space-y-4 text-cream/80"><h2 className="text-2xl text-cream">Trading with Harry allocation terms</h2><p className="text-sm text-gold-300">Version {tradingTermsVersion}</p><p>New requests require an active Form Room or Inner Circle membership, a confirmed email, an active account and an available wallet. Allocate $500–$10,000 from approved club credit, with a maximum $10,000 across open allocations. A pending request does not reserve funds; you may cancel it before approval. Membership is checked again on approval.</p><p>Only Super Admin approval moves the principal into a locked allocation. The lock lasts exactly 33 days from the saved approval time in UTC, with no early withdrawal. Membership expiry after approval does not erase an existing allocation or its payout obligation.</p><p>All proposed daily targets are unverified and non-contractual. They are not a forecast or promised rate. There is no daily accrual or compounding in this app. Some or all principal can be lost. Actual net results may be negative, zero or positive and require a supporting manual record.</p><p>After maturity, the Super Admin records the actual net profit or loss. Any amount due is principal plus that recorded result. The operator manually sends it to the external address, token and network you confirmed when requesting. The lock ending is not proof of payment; payment is complete only after the transfer is verified and recorded. A verified total loss has no payout transaction. The operator pays outgoing network fees separately.</p><p>Each USDT or USDC token is recorded as $1 of nominal USD club credit. This is an accounting convention, not a live market exchange quote or a guarantee of token value. Use only the token, network and address shown for your deposit. Report the transaction before requesting allocation credit. Only verified deposits are credited; general credit withdrawals and member-to-member transfers are not supported. Contact {brand.supportEmail} about payment errors or unresolved funds.</p><p>Your request saves the terms version, membership, amount and external payout destination. The destination cannot be changed after requesting. Correct a pending request by cancelling and creating a new one. Approval, actual results and completed payouts are kept in the account history. The website does not automatically deduct a performance fee or calculate a promised return.</p></section>}
    </div>
  );
}
