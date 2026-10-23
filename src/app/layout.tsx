import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { brand } from "@/lib/config";
import "./globals.css";
import { walletTestMode } from "@/lib/environment";
import { pageMetadata, siteOrigin } from "@/lib/seo";
import { SiteChrome } from "@/components/SiteChrome";
import { headers } from "next/headers";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  ...pageMetadata("/"),
  title: { default: `${brand.name} · Trading with Rob`, template: `%s · ${brand.name}` },
  metadataBase: new URL(siteOrigin),
  applicationName: brand.name,
  category: "Horse racing and Trading with Rob",
  // Explicit links keep icons in the rendered metadata on the Worker adapter,
  // rather than relying on automatic discovery of app/icon.svg.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = { themeColor: "#06140f", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const entrance = (await headers()).get("x-furlong-entrance") === "1";
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">
        {walletTestMode() && (
          <div className="bg-gold-400 px-4 py-1.5 text-center text-xs font-semibold text-turf-950">
            Wallet test site · All balances and payments are simulated. Do not send real cryptocurrency.
          </div>
        )}
        <a href="#main-content" className="fixed left-4 top-3 z-50 -translate-y-24 rounded-xl bg-gold-400 px-5 py-3 font-semibold text-turf-950 transition-transform focus:translate-y-0">Skip to content</a>
        <SiteChrome header={entrance ? null : <SiteHeader />} footer={entrance ? null : <SiteFooter />}>{children}</SiteChrome>
      </body>
    </html>
  );
}
