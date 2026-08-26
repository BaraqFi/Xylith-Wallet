// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import PrivyProvider from "./privyProvider"; // ← default import (correct)
import { site } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#191f21' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  // The app subdomain is a product surface, not a landing page: keep it out of
  // search results so the marketing site is the only indexed entry point.
  robots: { index: false, follow: false },
  alternates: { canonical: site.url },
  title: "Xylith Wallet",
  description:
    "AI-powered multi-chain crypto wallet. Manage, send, swap, and trade across EVM and Solana.",
  // The app previously had no social card at all — links to it unfurled bare.
  // Shares the landing page's card so both surfaces present the same identity.
  openGraph: {
    type: "website",
    url: site.url,
    siteName: "Xylith",
    title: "Xylith Wallet",
    description:
      "AI-powered multi-chain crypto wallet. Manage, send, swap, and trade across EVM and Solana.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Xylith — say it, it's done.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Xylith Wallet",
    description:
      "AI-powered multi-chain crypto wallet. Manage, send, swap, and trade across EVM and Solana.",
    images: ["/og.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Xylith",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <PrivyProvider>
          {children}
        </PrivyProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}