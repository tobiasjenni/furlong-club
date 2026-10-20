import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { brand } from "@/lib/config";
import "./globals.css";
import { walletTestMode } from "@/lib/environment";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${brand.name} · Learn to read the race`, template: `%s · ${brand.name}` },
  description: `Horse racing education and race-day tip videos, hosted by ${brand.host.name}, our paddock guide.`,
  metadataBase: new URL(`https://${brand.domain}`),
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} · Learn to read the race`,
    description: "Learn to study form, judge the going and manage your stake, with race-day breakdowns before the off.",
  },
  twitter: { card: "summary_large_image" },
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
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
