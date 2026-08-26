// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@web3icons/react"],

  // Baseline security headers. HSTS comes from Vercel automatically; a full
  // CSP is deferred — Privy's auth iframe and Next's inline scripts need a
  // carefully tested policy, and a broken CSP on a wallet blocks sign-in.
  // frame-ancestors alone closes the clickjacking hole without that risk
  // (Privy's iframe is a child of our page, so framing *us* stays deniable).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  // Keep externals for Pino/thread-stream (avoids bundling tests/workers)
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  // Package imports are optimized:
  // - lucide-react: Already optimized with named imports
  // - @web3icons/react: Refactored to individual imports (see ManualWallet.tsx)
  // - @radix-ui: Uses namespace imports (recommended pattern)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['qrcode/lib/renderer/terminal'] = false;
      config.resolve.alias['qrcode/lib/renderer/utf8'] = false;
      // Optional Privy peer for Farcaster mini-apps — not a feature we ship.
      config.resolve.alias['@farcaster/mini-app-solana'] = false;
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      'qrcode/lib/renderer/terminal': '',
      'qrcode/lib/renderer/utf8': '',
      '@farcaster/mini-app-solana': '',
    },
  },
};

export default nextConfig;