/**
 * Centralized RPC Configuration
 * 
 * Provides a unified way to get RPC clients with preferred endpoints
 * Handles fallback logic and rate-limit friendly rotation
 */

import { createPublicClient, http, PublicClient, Chain } from "viem";
import { mainnet, arbitrum, optimism, polygon, base, bsc } from "viem/chains";
import { EVMChain } from "@/components/wallet/data";

// Map our internal chain IDs to Viem chains
const chainMap: Record<EVMChain, Chain> = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  optimism: optimism,
  polygon: polygon,
  base: base,
  bsc: bsc,
};

/**
 * Get Ankr API key from environment
 *
 * IMPORTANT:
 * - We ONLY ever read ANKR_API_KEY on the server.
 * - On the client, we never use the authenticated Ankr endpoints to avoid exposing the key.
 */
function getAnkrApiKey(): string | null {
  if (typeof window !== "undefined") {
    // Client-side: never expose or rely on ANKR_API_KEY
    return null;
  }
  // Server-side: safe to read ANKR_API_KEY (not exposed to the browser)
  return process.env.ANKR_API_KEY || null;
}

/**
 * Build Ankr RPC URL with API key if available
 */
function buildAnkrUrl(chainPath: string): string {
  const apiKey = getAnkrApiKey();
  const baseUrl = `https://rpc.ankr.com/${chainPath}`;
  return apiKey ? `${baseUrl}?apikey=${apiKey}` : baseUrl;
}

/**
 * Preferred public RPC endpoints for each chain.
 *
 * Server:
 * - If ANKR_API_KEY is present, we prioritize authenticated Ankr endpoints.
 * - Otherwise, we fall back to other public endpoints.
 *
 * Client:
 * - We prioritize our own server-side RPC proxy (/api/rpc).
 * - This allows us to share the server's rotating providers (Ankr/Infura/Alchemy) securely.
 */
function getPublicRpcEndpoints(): Record<EVMChain, string[]> {
  const ankrApiKey = getAnkrApiKey();
  const useAnkr = !!ankrApiKey;
  const isServer = typeof window === "undefined";

  // Helper to get proxy URL
  const getProxyUrl = (chain: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/api/rpc?chain=${chain}` : '';

  // Helper to get server-side preferred endpoints
  const getServerEndpoints = (chain: string, ankrUrl: string, publicUrls: string[]) => {
    return useAnkr ? [ankrUrl, ...publicUrls] : publicUrls;
  };

  // Helper to get client-side preferred endpoints (Proxy -> Public Fallbacks)
  const getClientEndpoints = (chain: string, publicUrls: string[]) => {
    const proxy = getProxyUrl(chain);
    return proxy ? [proxy, ...publicUrls] : publicUrls;
  };

  return {
    ethereum: isServer
      ? getServerEndpoints("eth", buildAnkrUrl("eth"), ["https://eth.llamarpc.com", "https://eth.merkle.io"])
      : getClientEndpoints("ethereum", []),

    base: isServer
      ? getServerEndpoints("base", buildAnkrUrl("base"), ["https://mainnet.base.org", "https://base.llamarpc.com"])
      : getClientEndpoints("base", ["https://mainnet.base.org"]),

    arbitrum: isServer
      ? getServerEndpoints("arbitrum", buildAnkrUrl("arbitrum"), ["https://arb1.arbitrum.io/rpc", "https://arbitrum.llamarpc.com"])
      : getClientEndpoints("arbitrum", ["https://arb1.arbitrum.io/rpc"]),

    optimism: isServer
      ? getServerEndpoints("optimism", buildAnkrUrl("optimism"), ["https://mainnet.optimism.io", "https://optimism.llamarpc.com"])
      : getClientEndpoints("optimism", ["https://mainnet.optimism.io"]),

    polygon: isServer
      ? getServerEndpoints("polygon", buildAnkrUrl("polygon"), ["https://polygon-rpc.com", "https://polygon.llamarpc.com"])
      : getClientEndpoints("polygon", ["https://polygon-rpc.com"]),

    bsc: isServer
      ? getServerEndpoints("bsc", buildAnkrUrl("bsc"), ["https://bsc-dataseed.binance.org", "https://bsc.llamarpc.com"])
      : getClientEndpoints("bsc", ["https://bsc-dataseed.binance.org"]),
  };
}

// Track current RPC index for rotation (simple round-robin)
let rpcIndexMap: Record<EVMChain, number> = {
  ethereum: 0,
  base: 0,
  arbitrum: 0,
  optimism: 0,
  polygon: 0,
  bsc: 0,
};

/**
 * Get the next RPC endpoint for a chain (round-robin)
 */
function getNextRpcUrl(chain: EVMChain): string {
  const endpoints = getPublicRpcEndpoints()[chain];
  if (!endpoints || endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain: ${chain}`);
  }

  const index = rpcIndexMap[chain];
  const url = endpoints[index];

  // Move to next endpoint for next call
  rpcIndexMap[chain] = (index + 1) % endpoints.length;

  return url;
}

/**
 * Get a public RPC client for a given chain
 * Uses preferred endpoints with fallback logic
 * 
 * Note: Alchemy-specific calls should still go through server-side API routes
 * This is for generic RPC calls that don't require API keys
 */
export function getPublicRpcClient(chain: EVMChain): PublicClient {
  const targetChain = chainMap[chain];
  if (!targetChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  // Get preferred RPC endpoint
  const rpcUrl = getNextRpcUrl(chain);

  return createPublicClient({
    chain: targetChain,
    transport: http(rpcUrl, {
      // Add timeout and retry logic
      timeout: 10000, // 10 second timeout
      retryCount: 2, // Retry twice on failure
    }),
  });
}

/**
 * Get a public RPC client with a specific RPC URL
 * Useful for local forks or custom RPC endpoints
 */
export function getCustomRpcClient(chain: EVMChain, rpcUrl: string): PublicClient {
  const targetChain = chainMap[chain];
  if (!targetChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  return createPublicClient({
    chain: targetChain,
    transport: http(rpcUrl),
  });
}

/**
 * Reset RPC index for a chain (useful for testing or manual rotation)
 */
export function resetRpcIndex(chain: EVMChain): void {
  rpcIndexMap[chain] = 0;
}

/**
 * Get all available RPC endpoints for a chain
 */
export function getRpcEndpoints(chain: EVMChain): string[] {
  return getPublicRpcEndpoints()[chain] || [];
}
