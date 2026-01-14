/**
 * Token Analytics Service
 * 
 * Fetches token price data and analytics from CoinGecko API
 * CoinGecko is free and reliable for price data
 */

import { EVMChain } from "@/components/wallet/data";
import { getCachedData, setCachedData } from "@/lib/utils/cache";

export interface TokenAnalytics {
  currentPriceUsd: number;
  priceChange24h: number;
  priceChange7d: number;
  marketCap?: number;
  volume24h?: number;
  sparkline?: number[];
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
}

// Cache TTL: 5 minutes for analytics (prices change frequently)
const ANALYTICS_CACHE_TTL = 5 * 60 * 1000;
// Cache TTL: 1 hour for price history (less frequent updates)
const HISTORY_CACHE_TTL = 60 * 60 * 1000;

export type AnalyticsChain = EVMChain | 'solana';

/**
 * Map EVM chains to CoinGecko platform IDs
 */
const COINGECKO_PLATFORM_MAP: Record<AnalyticsChain, string> = {
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  polygon: "polygon-pos",
  bsc: "binance-smart-chain",
  solana: "solana",
};

/**
 * Map common token symbols to CoinGecko IDs
 * For native tokens and major tokens, we can use symbol-based lookup
 */
const COINGECKO_TOKEN_ID_MAP: Record<string, string> = {
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  WBTC: "wrapped-bitcoin",
  DAI: "dai",
  MATIC: "matic-network",
  ARB: "arbitrum",
  OP: "optimism",
  BNB: "binancecoin",
  SOL: "solana",
  RAY: "raydium",
  JUP: "jupiter-exchange-solana",
};

/**
 * Get CoinGecko token ID from contract address and chain
 * For now, we'll use symbol-based lookup for major tokens
 * In production, you might want to use CoinGecko's contract address API
 */
function getCoinGeckoTokenId(symbol: string, contractAddress?: string): string | null {
  // First try symbol-based lookup
  const symbolId = COINGECKO_TOKEN_ID_MAP[symbol.toUpperCase()];
  if (symbolId) {
    return symbolId;
  }

  // For unknown tokens, return null (will need contract address lookup)
  // CoinGecko has an API endpoint for contract address lookup, but it requires API key for rate limits
  return null;
}

/**
 * Fetch token analytics from CoinGecko
 */
export async function getTokenAnalytics(
  symbol: string,
  chain: AnalyticsChain,
  contractAddress?: string
): Promise<TokenAnalytics | null> {
  const cacheKey = `xylith_analytics_${chain}_${symbol}_${contractAddress || "native"}`;

  // Check cache first
  const cached = getCachedData<TokenAnalytics>(cacheKey, ANALYTICS_CACHE_TTL);
  if (cached) {
    return cached;
  }

  const tokenId = getCoinGeckoTokenId(symbol, contractAddress);
  if (!tokenId) {
    // Token not found in our mapping - return null
    // In production, you could use CoinGecko's contract address API here
    return null;
  }

  try {
    // CoinGecko free API endpoint
    // Using /simple/price endpoint which doesn't require API key
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true&include_24hr_vol=true`;

    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const tokenData = data[tokenId];

    if (!tokenData) {
      return null;
    }

    // Fetch sparkline data
    const sparkline = await getTokenSparkline(symbol, chain, contractAddress);

    const analytics: TokenAnalytics = {
      currentPriceUsd: tokenData.usd || 0,
      priceChange24h: tokenData.usd_24h_change || 0,
      priceChange7d: tokenData.usd_7d_change || 0,
      marketCap: tokenData.usd_market_cap || undefined,
      volume24h: tokenData.usd_24h_vol || undefined,
      sparkline: sparkline || undefined,
    };

    // Cache the result
    setCachedData(cacheKey, analytics);

    return analytics;
  } catch (error) {
    console.error("Error fetching token analytics:", error);
    return null;
  }
}

/**
 * Fetch token price history (sparkline data for last 7 days)
 */
export async function getTokenPriceHistory(
  symbol: string,
  chain: AnalyticsChain,
  contractAddress?: string,
  days: number = 7
): Promise<PriceHistoryPoint[] | null> {
  const cacheKey = `xylith_history_${chain}_${symbol}_${contractAddress || "native"}_${days}`;

  // Check cache first
  const cached = getCachedData<PriceHistoryPoint[]>(cacheKey, HISTORY_CACHE_TTL);
  if (cached) {
    return cached;
  }

  const tokenId = getCoinGeckoTokenId(symbol, contractAddress);
  if (!tokenId) {
    return null;
  }

  try {
    // CoinGecko market chart endpoint
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`;

    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const prices = data.prices || [];

    const history: PriceHistoryPoint[] = prices.map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price,
    }));

    // Extract sparkline (just the prices)
    const sparkline = prices.map(([, price]: [number, number]) => price);

    // Cache the result
    setCachedData(cacheKey, history);

    return history;
  } catch (error) {
    console.error("Error fetching token price history:", error);
    return null;
  }
}

/**
 * Get sparkline data (array of prices) for last 7 days
 */
export async function getTokenSparkline(
  symbol: string,
  chain: AnalyticsChain,
  contractAddress?: string
): Promise<number[] | null> {
  const history = await getTokenPriceHistory(symbol, chain, contractAddress, 7);
  if (!history) {
    return null;
  }

  return history.map((point) => point.price);
}
