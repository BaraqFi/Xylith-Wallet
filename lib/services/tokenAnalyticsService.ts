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
  // Ethereum
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  WBTC: "wrapped-bitcoin",
  DAI: "dai",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  CRV: "curve-dao-token",
  MKR: "maker",

  // Base
  BRETT: "brett-base",
  DEGEN: "degen-base",
  AERO: "aerodrome-finance",
  BSX: "bsx-base",
  TOSHI: "toshi",
  MOONWELL: "moonwell-artemis",

  // Arbitrum
  ARB: "arbitrum",
  GMX: "gmx",
  RDNT: "radiant-capital",
  MAGIC: "magic",
  GRAIL: "camelot-token",
  STG: "stargate-finance",

  // Optimism
  OP: "optimism",
  VELO: "velodrome-finance",
  SNX: "havven",
  SONNE: "sonne",
  THALES: "thales",

  // Polygon
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  WETH: "weth",
  RENDER: "render-token",
  QUICK: "quickswap",
  GHST: "aavegotchi",

  // BSC
  BNB: "binancecoin",
  CAKE: "pancakeswap-token",
  XRP: "ripple",
  BUSD: "binance-usd",
  ALPACA: "alpaca-finance",

  // Solana
  SOL: "solana",
  RAY: "raydium",
  JUP: "jupiter-exchange-solana",
  BONK: "bonk",
  WIF: "dogwifcoin",
  PYTH: "pyth-network",
  JTO: "jito-governance-token",
  POPCAT: "popcat",
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
 * Fetch current prices for multiple tokens (Batch)
 * Falls back to CoinCap if CoinGecko fails
 */
export async function getTokenPricesBatch(
  tokens: { symbol: string; contractAddress?: string }[],
  currency: string = "usd"
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const coinGeckoIds: string[] = [];
  const tokenMap: Record<string, string[]> = {}; // geckoid -> [symbols]

  // 1. Prepare CoinGecko IDs
  for (const token of tokens) {
    const id = getCoinGeckoTokenId(token.symbol, token.contractAddress);
    if (id) {
      if (!tokenMap[id]) tokenMap[id] = [];
      tokenMap[id].push(token.symbol);
      if (!coinGeckoIds.includes(id)) coinGeckoIds.push(id);
    }
  }

  // 2. Try CoinGecko Batch Fetch
  if (coinGeckoIds.length > 0) {
    try {
      const idsParam = coinGeckoIds.join(",");
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=${currency}`;

      const response = await fetch(url, { next: { revalidate: 120 } }); // 2 min cache

      if (response.ok) {
        const data = await response.json();
        for (const [id, priceData] of Object.entries(data)) {
          const price = (priceData as any)[currency];
          if (price) {
            const symbols = tokenMap[id];
            symbols?.forEach(sym => {
              prices[sym] = price;
            });
          }
        }
      } else {
        console.warn("CoinGecko Batch Failed:", response.status);
      }
    } catch (err) {
      console.error("CoinGecko Batch Error:", err);
    }
  }

  // 3. Fallback removed (User Request)
  return prices;
}

/**
 * Fetch token analytics from Moralis (for EVM tokens)
 * Moralis metadata endpoint includes market cap, supply, and other analytics
 */
async function getMoralisAnalytics(
  contractAddress: string,
  chain: EVMChain
): Promise<TokenAnalytics | null> {
  const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
  if (!MORALIS_API_KEY) return null;

  try {
    const CHAIN_MAP: Record<EVMChain, string> = {
      ethereum: "eth",
      base: "base",
      arbitrum: "arbitrum",
      optimism: "optimism",
      polygon: "polygon",
      bsc: "bsc",
    };

    const moralisChain = CHAIN_MAP[chain] || "eth";
    const url = `https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain=${moralisChain}&addresses%5B0%5D=${contractAddress}`;

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const token = data[0];
    
    // Moralis provides market cap and supply data
    const marketCap = token.market_cap ? parseFloat(token.market_cap) : undefined;
    const circulatingSupply = token.circulating_supply ? parseFloat(token.circulating_supply) : undefined;
    
    // Calculate price from market cap and supply if available
    let currentPriceUsd = 0;
    if (marketCap && circulatingSupply && circulatingSupply > 0) {
      currentPriceUsd = marketCap / circulatingSupply;
    }

    return {
      currentPriceUsd,
      priceChange24h: 0, // Moralis doesn't provide this in metadata endpoint
      priceChange7d: 0, // Moralis doesn't provide this in metadata endpoint
      marketCap,
      volume24h: undefined, // Not available in metadata endpoint
      sparkline: undefined,
    };
  } catch (error) {
    console.warn("Moralis analytics fetch failed:", error);
    return null;
  }
}

/**
 * Fetch token analytics from CoinGecko or Moralis
 * Priority: Moralis (for EVM with contract) > CoinGecko
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

  // 1. Try Moralis first for EVM tokens with contract address
  if (contractAddress && chain !== 'solana') {
    const moralisAnalytics = await getMoralisAnalytics(contractAddress, chain as EVMChain);
    if (moralisAnalytics && moralisAnalytics.currentPriceUsd > 0) {
      // Enhance with CoinGecko price changes if available
      const tokenId = getCoinGeckoTokenId(symbol, contractAddress);
      if (tokenId) {
        try {
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true`;
          const response = await fetch(url, { next: { revalidate: 300 } });
          if (response.ok) {
            const data = await response.json();
            const tokenData = data[tokenId];
            if (tokenData) {
              moralisAnalytics.priceChange24h = tokenData.usd_24h_change || 0;
              moralisAnalytics.priceChange7d = tokenData.usd_7d_change || 0;
              // Use CoinGecko price if available (more accurate)
              if (tokenData.usd) {
                moralisAnalytics.currentPriceUsd = tokenData.usd;
              }
            }
          }
        } catch (err) {
          console.warn("Failed to enhance with CoinGecko data:", err);
        }
      }

      // Fetch sparkline from CoinGecko
      const sparkline = await getTokenSparkline(symbol, chain, contractAddress);
      moralisAnalytics.sparkline = sparkline || undefined;

      setCachedData(cacheKey, moralisAnalytics);
      return moralisAnalytics;
    }
  }

  // 2. Fallback to CoinGecko
  const tokenId = getCoinGeckoTokenId(symbol, contractAddress);
  if (!tokenId) {
    return null;
  }

  try {
    // CoinGecko free API endpoint
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
