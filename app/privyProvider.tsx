"use client";

import { PrivyProvider } from '@privy-io/react-auth';
import { mainnet, sepolia } from 'viem/chains';
import type { ReactNode } from 'react';

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
          mainnet,
          sepolia,

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