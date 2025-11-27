// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import PrivyProvider from "./privyProvider"; // ← default import (correct)

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Xylith Manual Wallet",
  description:
    "Manual wallet workspace for monitoring balances, transfers, and swaps.",
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
      </body>
    </html>
  );
}