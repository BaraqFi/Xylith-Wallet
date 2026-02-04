import { EVMChain, TokenBalance } from "@/components/wallet/data";

// Map EVM chains to 1inch chain IDs
const CHAIN_ID_MAP: Record<EVMChain, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  bsc: 56,
};

export interface TokenListToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

const CACHE_KEY_PREFIX = "xylith_token_list_";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedTokenList {
  tokens: TokenListToken[];
  timestamp: number;
}

/**
 * Fetch token list from 1inch API
 */
export async function fetch1inchTokenList(
  chain: EVMChain
): Promise<TokenListToken[]> {
  const chainId = CHAIN_ID_MAP[chain];
  if (!chainId) {
    throw new Error(`Unsupported chain for 1inch: ${chain}`);
  }

  try {
    const response = await fetch(`https://tokens.1inch.io/v1.1/${chainId}`);
    if (!response.ok) {
      throw new Error(`1inch API error: ${response.statusText}`);
    }

    const data = await response.json();
    // 1inch returns an object with token addresses as keys
    const tokens = Object.values(data) as TokenListToken[];

    // Basic runtime validation of token entries
    return tokens.filter(
      (t) =>
        t &&
        typeof t.address === "string" &&
        /^0x[a-fA-F0-9]{40}$/.test(t.address) &&
        typeof t.symbol === "string" &&
        typeof t.name === "string" &&
        typeof t.decimals === "number"
    );
  } catch (error) {
    console.error("Error fetching 1inch token list:", error);
    throw error;
  }
}

/**
 * Get cached token list or fetch new one
 *
 * Note: This uses localStorage client-side; callers should treat it as
 * a performance cache only and not as a trusted data source.
 */
export async function getTokenList(
  chain: EVMChain,
  forceRefresh = false
): Promise<TokenListToken[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}${chain}`;

  // Check cache if not forcing refresh
  if (typeof window !== "undefined" && !forceRefresh) {
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: CachedTokenList = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_DURATION && Array.isArray(parsed.tokens)) {
          return parsed.tokens;
        }
      }
    } catch (error) {
      console.warn("Error reading token list cache:", error);
    }
  }

  // Fetch new token list
  const tokens = await fetch1inchTokenList(chain);

  // Cache the result (client-only)
  if (typeof window !== "undefined") {
    try {
      const cacheData: CachedTokenList = {
        tokens,
        timestamp: Date.now(),
      };
      window.localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Error caching token list:", error);
    }
  }

  return tokens;
}

/**
 * Convert 1inch token list to TokenBalance format
 */
export function convertToTokenBalance(
  token: TokenListToken,
  chain: EVMChain,
  balance?: number,
  usdValue?: number
): TokenBalance {
  return {
    symbol: token.symbol,
    name: token.name,
    chain: "EVM",
    evmChain: chain,
    amount: balance || 0,
    usdValue: usdValue || 0,
    contractAddress: token.address,
    decimals: token.decimals,
    logo: token.logoURI,
  };
}

/**
 * Search tokens by symbol, name, or contract address
 */
export function searchTokens(
  tokens: TokenListToken[],
  query: string
): TokenListToken[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return tokens;
  }

  const lowerQuery = trimmed.toLowerCase();

  // Precompute fields for more efficient filtering on large lists
  return tokens.filter((token) => {
    const symbol = token.symbol.toLowerCase();
    const name = token.name.toLowerCase();
    const address = token.address.toLowerCase();
    return (
      symbol.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      address.includes(lowerQuery)
    );
  });
}

/**
 * Get popular tokens (common stablecoins and major tokens)
 */
export function getPopularTokens(chain: EVMChain): string[] {
  const popularMap: Record<EVMChain, string[]> = {
    ethereum: [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    ],
    base: [
      "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913", // USDC
    ],
    arbitrum: [
      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    ],
    optimism: [
      "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
    ],
    polygon: [
      "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
    ],
    bsc: [
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
      "0x55d398326f99059fF775485246999027B3197955", // USDT
    ],
  };

  return popularMap[chain] || [];
}

