import type { Metadata } from "next";
import { brand } from "./config";
import { clubGateEnabled } from "./club-gate";

export const siteOrigin = `https://${brand.domain}`;
export const siteUrl = (path = "/") => new URL(path, `${siteOrigin}/`).href;
export const publicPages = {
  "/": { title: "Trading with Rob & Horse Racing", description: "Sign up free for Trading with Rob. Join moon-calendar syndicates with manual funding approval and a 28-day trading period." },
  "/trading": { title: "Trading with Rob: Allocation & 28-Day Lock", description: "Explore Trading with Rob: separately funded $500–$10,000 allocations, manual deposit approval, a 28-day lock and recorded external payouts." },
  "/plans": { title: "Subscriptions Coming Soon", description: "Paid subscriptions are coming soon. Sign up free for Trading with Rob, explore 28-day allocations and follow your recorded results." },
  "/meet-rob": { title: "Meet Rob · Furlong Club Trader", description: "Meet Rob, the host of Furlong Club. Explore his syndicate, the published moon-calendar entries and the 28-day trading process." },
  "/legal/terms": { title: "Terms of Service", description: "Read Furlong Club’s membership, payment and account terms, including free accounts, 28-day trading allocations and manual funding approval." },
  "/legal/privacy": { title: "Privacy Policy & Account Data", description: "Learn how Furlong Club uses and retains account details, payment records and trading information, and how to contact us about your personal data." },
  "/legal/responsible-gambling": { title: "Responsible Gambling & Member Support", description: "Read Furlong Club’s responsible gambling guidance: set limits, avoid chasing losses, find support and learn how to request account closure." },
} as const;
export type PublicPath = keyof typeof publicPages;

export const privateMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export function pageMetadata(path: PublicPath): Metadata {
  const { title, description } = publicPages[path];
  const index = !clubGateEnabled() && process.env.APP_ENV !== "staging";
  const fullTitle = `${title} | ${brand.name}`;
  const images = [{ url: siteUrl("/social/furlong-club-rob.png"), width: 1200, height: 630, alt: "Furlong Club — Trading with Rob and horse racing insights" }];
  return {
    title: { absolute: fullTitle }, description,
    alternates: { canonical: siteUrl(path) },
    robots: { index, follow: index, googleBot: { index, follow: index, "max-image-preview": "large" } },
    openGraph: { type: "website", locale: "en_GB", siteName: brand.name, title: fullTitle, description, url: siteUrl(path), images },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: images.map(image => ({ url: image.url, alt: image.alt })) },
  };
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export const organization = {
  "@type": "Organization", "@id": siteUrl("/#organization"), name: brand.name,
  url: siteUrl(), email: brand.supportEmail,
  logo: { "@type": "ImageObject", url: siteUrl("/brand-logo.png"), width: 512, height: 512 },
};

export const website = {
  "@type": "WebSite", "@id": siteUrl("/#website"), name: brand.name,
  alternateName: brand.domain, url: siteUrl(), inLanguage: "en",
  publisher: { "@id": organization["@id"] },
};
