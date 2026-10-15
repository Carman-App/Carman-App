import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Showrooms — Find your next car in Kenya", template: "%s · Showrooms" },
  description: "Discover vehicles from brokers, dealers and independent sellers across Kenya. Prices in KES, verified sellers, contact on WhatsApp.",
  applicationName: "Showrooms",
  openGraph: { type: "website", siteName: "Showrooms", locale: "en_KE" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-raised">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
