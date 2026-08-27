"use client";

import { PrivyProvider } from '@privy-io/react-auth';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';
import { useMemo, type ReactNode } from 'react';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
// Side-effect import: installs the Buffer global that @solana/web3.js needs.
import '@/lib/solana/bufferPolyfill';

/** Match Privy's login UI to whichever theme the app will paint. */
function resolveTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Use server-side RPC proxy for all chains
// This rotates between Ankr, Infura, Alchemy, and public nodes
function getRpcUrl(chainName: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/rpc?chain=${chainName}`;
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
  /**
   * Privy's Solana standard-wallet hooks resolve an RPC per chain and THROW
   * during render when one is missing ("No RPC configuration found for chain
   * solana:mainnet") — which took down the whole page the moment the signer
   * opened. Reads go through our own proxy so provider keys stay server-side;
   * the subscriptions endpoint is a public WS because it needs no key and our
   * flows sign locally and broadcast themselves rather than using Privy's
   * send-and-confirm.
   */
  const solanaConfig = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const httpUrl = `${window.location.origin}/api/rpc?chain=solana`;
    const wsUrl =
      process.env.NEXT_PUBLIC_SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
    return {
      rpcs: {
        'solana:mainnet': {
          rpc: createSolanaRpc(httpUrl),
          rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
          blockExplorerUrl: 'https://explorer.solana.com',
        },
      },
    };
  }, []);

  return (
    <PrivyProvider
      appId="cmid35rfp01xlks0cujzvl6wk"
      config={{
        ...(solanaConfig ? { solana: solanaConfig } : {}),
        // Without this Privy renders its own default purple, which fights the
        // brand accent on the sign-in screen. Resolved once at mount: Privy
        // remounts its UI tree if the theme prop changes, so this deliberately
        // does not track live theme toggles.
        appearance: {
          theme: resolveTheme(),
          accentColor: '#62d7dd',
          walletChainType: 'ethereum-and-solana',
        },

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
      {/* All Alchemy Account Kit operations (EIP-7702 delegation, session keys,
          transaction signing) run server-side in /api/ai/* routes where
          ALCHEMY_API_KEY is accessed securely. No API keys on the client. */}
      {children}
    </PrivyProvider>
  );
}