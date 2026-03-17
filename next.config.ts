// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@web3icons/react"],

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
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      'qrcode/lib/renderer/terminal': '',
      'qrcode/lib/renderer/utf8': '',
    },
  },
};

export default nextConfig;