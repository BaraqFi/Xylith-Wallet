"use client";

import { PrivyProvider } from '@privy-io/react-auth';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';
import type { ReactNode } from 'react';

// Use public RPC endpoints - Alchemy calls go through server-side API routes
// This prevents API key exposure in client-side code
function getRpcUrl(chainName: string): string {
  // Use public RPC endpoints as fallback
  // For Alchemy-specific calls, use /api/alchemy/rpc proxy
  const publicRpcMap: Record<string, string> = {
    ethereum: 'https://eth.llamarpc.com',
    base: 'https://mainnet.base.org',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    polygon: 'https://polygon-rpc.com',
    bsc: 'https://bsc-dataseed.binance.org',
  };

  return publicRpcMap[chainName] || '';
}

// Create chain configurations with public RPC URLs
// Alchemy-specific calls go through server-side API routes to protect API keys
const mainnetWithRpc = {
  ...mainnet,
  rpcUrls: {
    ...mainnet.rpcUrls,
    default: {
      http: getRpcUrl('ethereum') ? [getRpcUrl('ethereum')] : mainnet.rpcUrls.default.http,
    },
  },
};

const arbitrumWithRpc = {
  ...arbitrum,
  rpcUrls: {
    ...arbitrum.rpcUrls,
    default: {
      http: getRpcUrl('arbitrum') ? [getRpcUrl('arbitrum')] : arbitrum.rpcUrls.default.http,
    },
  },
};

const optimismWithRpc = {
  ...optimism,
  rpcUrls: {
    ...optimism.rpcUrls,
    default: {
      http: getRpcUrl('optimism') ? [getRpcUrl('optimism')] : optimism.rpcUrls.default.http,
    },
  },
};

const polygonWithRpc = {
  ...polygon,
  rpcUrls: {
    ...polygon.rpcUrls,
    default: {
      http: getRpcUrl('polygon') ? [getRpcUrl('polygon')] : polygon.rpcUrls.default.http,
    },
  },
};

const baseWithRpc = {
  ...base,
  rpcUrls: {
    ...base.rpcUrls,
    default: {
      http: getRpcUrl('base') ? [getRpcUrl('base')] : base.rpcUrls.default.http,
    },
  },
};

const bscWithRpc = {
  ...bsc,
  rpcUrls: {
    ...bsc.rpcUrls,
    default: {
      http: getRpcUrl('bsc') ? [getRpcUrl('bsc')] : bsc.rpcUrls.default.http,
    },
  },
};

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId="cmid35rfp01xlks0cujzvl6wk"
      config={{
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          solana: { createOnLogin: 'users-without-wallets' },
        },

        supportedChains: [
          mainnetWithRpc,
          arbitrumWithRpc,
          optimismWithRpc,
          polygonWithRpc,
          baseWithRpc,
          bscWithRpc,
          {
            id: 1337,
            name: 'Local Mainnet Fork',
            network: 'local-fork',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['http://127.0.0.1:8545'] },
              public: { http: ['http://127.0.0.1:8545'] },
            },
            blockExplorers: {
              default: { name: 'Local', url: 'http://127.0.0.1:8545' },
            },
            testnet: true,
          } as const,
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}