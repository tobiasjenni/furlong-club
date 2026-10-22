import type { Metadata } from "next";
import { brand } from "./config";
import { clubGateEnabled } from "./club-gate";

export const siteOrigin = `https://${brand.domain}`;
export const siteUrl = (path = "/") => new URL(path, `${siteOrigin}/`).href;
export const publicPages = {
  "/": { title: "Trading with Harry & Horse Racing", description: "Explore Trading with Harry and 33-day Form Room membership. Discover Harry Whitcombe’s 40+ years of racing experience. Explore manual funding and allocation approvals." },
  "/trading": { title: "Trading with Harry: Allocation & 33-Day Lock", description: "Explore Trading with Harry: separately funded $500–$10,000 allocations, manual deposit approval, a 33-day lock and recorded external payouts." },
  "/plans": { title: "Form Room Membership & 33-Day Plans", description: "Compare Paddock, Form Room and Inner Circle membership. Explore Trading with Harry access and 33-day paid plans with no automatic renewal." },
  "/meet-harry": { title: "Meet Harry Whitcombe · 40+ Years in Racing", description: "Meet Harry Whitcombe, the host of Furlong Club. Discover his 40+ years of experience reading horses, understanding riders and studying race conditions." },
  "/legal/terms": { title: "Terms of Service", description: "Read Furlong Club’s membership, payment and account terms, including 33-day access, separate trading allocations and current trading availability." },
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
  const images = [{ url: siteUrl("/social/furlong-club.png"), width: 1200, height: 630, alt: "Furlong Club — Trading with Harry and horse racing insights" }];
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
