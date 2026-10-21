import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { brand } from "@/lib/config";
import "./globals.css";
import { walletTestMode } from "@/lib/environment";
import { pageMetadata, siteOrigin } from "@/lib/seo";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  ...pageMetadata("/"),
  title: { default: `${brand.name} · Trading with Harry`, template: `%s · ${brand.name}` },
  metadataBase: new URL(siteOrigin),
  applicationName: brand.name,
  category: "Horse racing membership and education",
  icons: { apple: "/apple-icon.png" },
};

export const viewport: Viewport = { themeColor: "#06140f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">
        {walletTestMode() && (
          <div className="bg-gold-400 px-4 py-1.5 text-center text-xs font-semibold text-turf-950">
            Wallet test site · All balances and payments are simulated. Do not send real cryptocurrency.
          </div>
        )}
        <a href="#main-content" className="fixed left-4 top-3 z-50 -translate-y-24 rounded-xl bg-gold-400 px-5 py-3 font-semibold text-turf-950 transition-transform focus:translate-y-0">Skip to content</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
