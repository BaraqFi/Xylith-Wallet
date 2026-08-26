import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { isValidContractAddress } from "@/lib/services/tokenMetadataService";
import { EVMChain } from "@/components/wallet/data";

interface TokenSearchResult {
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string;
  logo: string;
  chain: "EVM";
  evmChain: EVMChain;
  amount: number;
  usdValue: number;
}

interface CoinGeckoSearchCoin {
    id: string;
    symbol: string;
    name: string;
    platforms: Record<string, string>;
    thumb: string;
}

interface MoralisErc20Metadata {
    symbol: string;
    name: string;
    decimals: string; // Moralis returns decimals as string
    address: string;
    logo?: string;
    thumbnail?: string;
}

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

// Map our internal chain IDs to Moralis chain strings
const CHAIN_MAP: Record<EVMChain, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
    polygon: "polygon",
    bsc: "bsc",
};

// Map EVM chains to CoinGecko platform IDs for fallback
const COINGECKO_PLATFORM_MAP: Record<EVMChain, string> = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum",
    polygon: "polygon-pos",
    bsc: "binance-smart-chain",
};

// Simple in-memory cache (for server-side caching)
// In production, consider using Redis or similar
const searchCache = new Map<string, { data: TokenSearchResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(query: string, chain: string): string {
    return `evm_search_${chain}_${query.toLowerCase()}`;
}

function getCachedResults(key: string): TokenSearchResult[] | null {
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        searchCache.delete(key); // Remove expired entry
    }
    return null;
}

function setCachedResults(key: string, data: TokenSearchResult[]): void {
    // Limit cache size to prevent memory issues
    if (searchCache.size > 1000) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) {
            searchCache.delete(firstKey);
        }
    }
    searchCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fallback to CoinGecko API for token search
 * CoinGecko has a search endpoint that can find tokens by name/symbol
 */
async function searchCoinGecko(query: string, chain: EVMChain): Promise<TokenSearchResult[]> {
    try {
        const platform = COINGECKO_PLATFORM_MAP[chain];
        if (!platform) return [];

        // CoinGecko search endpoint (free, no API key required)
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
        const searchRes = await fetch(searchUrl, {
            next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!searchRes.ok) return [];

        const searchData = await searchRes.json();
        const coins = searchData.coins || [];

        // Filter by platform and get top 5 results
        const platformCoins = coins
            .filter((coin: CoinGeckoSearchCoin) => {
                // Check if coin is on the requested platform
                const platforms = coin.platforms || {};
                return Object.keys(platforms).some(p =>
                    p.toLowerCase().includes(platform.toLowerCase().split('-')[0])
                );
            })
            .slice(0, 5);

        // Fetch detailed info for each coin
        const results: TokenSearchResult[] = [];
        for (const coin of platformCoins) {
            try {
                const detailUrl = `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
                const detailRes = await fetch(detailUrl, {
                    next: { revalidate: 300 },
                });

                if (detailRes.ok) {
                    const detail = await detailRes.json();
                    const platforms = detail.platforms || {};
                    const contractAddress = Object.values(platforms)[0] as string;

                    if (contractAddress) {
                        results.push({
                            symbol: detail.symbol?.toUpperCase() || coin.symbol,
                            name: detail.name || coin.name,
                            decimals: 18, // CoinGecko doesn't provide decimals, default to 18
                            contractAddress: contractAddress.toLowerCase(),
                            logo: detail.image?.small || coin.thumb,
                            chain: "EVM",
                            evmChain: chain,
                            amount: 0,
                            usdValue: 0,
                        });
                    }
                }
            } catch (err) {
                console.warn(`Failed to fetch CoinGecko detail for ${coin.id}:`, err);
            }
        }

        return results;
    } catch (error) {
        console.error("CoinGecko search error:", error);
        return [];
    }
}

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const chain = (searchParams.get("chain") as EVMChain) || "ethereum";

    if (!query || query.trim().length < 2) {
        return NextResponse.json([]);
    }

    const trimmedQuery = query.trim();
    const cacheKey = getCacheKey(trimmedQuery, chain);

    // Check cache first
    const cached = getCachedResults(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
    }

    const moralisChain = CHAIN_MAP[chain] || "eth";
    let results: TokenSearchResult[] = [];

    try {
        // 1. Try Moralis first (primary)
        if (MORALIS_API_KEY) {
            if (isValidContractAddress(trimmedQuery)) {
                // Search by contract address
                const url = `https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain=${moralisChain}&addresses%5B0%5D=${trimmedQuery}`;
                const res = await fetch(url, {
                    headers: {
                        accept: "application/json",
                        "X-API-Key": MORALIS_API_KEY,
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    results = data.map((t: MoralisErc20Metadata) => ({
                        symbol: t.symbol,
                        name: t.name,
                        decimals: parseInt(t.decimals) || 18,
                        contractAddress: t.address?.toLowerCase(),
                        logo: t.logo || t.thumbnail,
                        chain: "EVM",
                        evmChain: chain,
                        amount: 0,
                        usdValue: 0,
                    }));
                }
            } else {
                // Search by symbol (exact match - Moralis limitation)
                const url = `https://deep-index.moralis.io/api/v2.2/erc20/metadata/symbols?chain=${moralisChain}&symbols%5B0%5D=${trimmedQuery.toUpperCase()}`;
                const res = await fetch(url, {
                    headers: {
                        accept: "application/json",
                        "X-API-Key": MORALIS_API_KEY,
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    results = data.map((t: MoralisErc20Metadata) => ({
                        symbol: t.symbol,
                        name: t.name,
                        decimals: parseInt(t.decimals) || 18,
                        contractAddress: t.address?.toLowerCase(),
                        logo: t.logo || t.thumbnail,
                        chain: "EVM",
                        evmChain: chain,
                        amount: 0,
                        usdValue: 0,
                    }));
                }
            }
        }

        // 2. Fallback to CoinGecko if Moralis fails or returns no results
        if (results.length === 0) {
            const coinGeckoResults = await searchCoinGecko(trimmedQuery, chain);
            results = coinGeckoResults;
        }

        // Cache results
        if (results.length > 0) {
            setCachedResults(cacheKey, results);
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Token search error:", error);
        // Try CoinGecko as last resort
        try {
            const coinGeckoResults = await searchCoinGecko(trimmedQuery, chain);
            if (coinGeckoResults.length > 0) {
                setCachedResults(cacheKey, coinGeckoResults);
                return NextResponse.json(coinGeckoResults);
            }
        } catch (fallbackError) {
            console.error("CoinGecko fallback also failed:", fallbackError);
        }
        return NextResponse.json({ error: "Failed to search tokens" }, { status: 500 });
    }
}
