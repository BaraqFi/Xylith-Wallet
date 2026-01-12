import { EVMChain } from "@/components/wallet/data";

/**
 * DEPRECATED: Use server-side API routes instead
 * These functions are kept for backward compatibility but should not expose API keys
 * 
 * For RPC calls, use public RPC endpoints or the /api/alchemy/rpc proxy
 * For Alchemy-specific APIs, use:
 * - /api/alchemy/token-balances
 * - /api/alchemy/native-balance  
 * - /api/alchemy/token-metadata
 */
export function getAlchemyRpcUrl(chain: EVMChain): string {
  // Return empty string - use public RPC or API proxy instead
  // This prevents API key exposure
  console.warn("getAlchemyRpcUrl is deprecated. Use public RPC or /api/alchemy/rpc proxy instead.");
  return '';
}

/**
 * DEPRECATED: Use server-side API routes instead
 */
export function getAlchemyApiUrl(chain: EVMChain): string {
  // Return empty string - use API routes instead
  console.warn("getAlchemyApiUrl is deprecated. Use /api/alchemy/* routes instead.");
  return '';
}

/**
 * Get chain ID for Alchemy API calls
 */
export function getChainId(chain: EVMChain): number {
  const chainIdMap: Record<EVMChain, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    optimism: 10,
    polygon: 137,
    bsc: 56,
  };

  return chainIdMap[chain];
}


