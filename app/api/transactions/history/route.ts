import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

interface AlchemyTransfer {
    category: "external" | "erc20" | "erc721" | "erc1155";
    rawContract: {
        address?: string;
    };
    to?: string;
    from?: string;
    value?: string;
    asset?: string;
    hash: string;
    metadata?: {
        blockTimestamp: string;
    };
    blockNum: string;
}

type AlchemyChain = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "bsc";

// Simple in-memory rate limiter and response cache to protect upstream RPCs.
// Note: These are best-effort protections and complement client-side caching.

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // per IP per window

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  // Vercel / Next will often populate req.ip; fall back to X-Forwarded-For.
  const directIp = (req as any).ip as string | undefined;
  if (directIp) return directIp;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

type CacheKey = string;

interface CacheEntry {
  timestamp: number;
  items: unknown[];
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const responseCache = new Map<CacheKey, CacheEntry>();

function makeCacheKey(chain: AlchemyChain, address: string, limit: number): CacheKey {
  return `${chain}:${address.toLowerCase()}:${limit}`;
}

function getCachedHistory(chain: AlchemyChain, address: string, limit: number): unknown[] | null {
  const key = makeCacheKey(chain, address, limit);
  const entry = responseCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }

  return entry.items;
}

function setCachedHistory(chain: AlchemyChain, address: string, limit: number, items: unknown[]): void {
  const key = makeCacheKey(chain, address, limit);
  responseCache.set(key, {
    timestamp: Date.now(),
    items,
  });
}

/**
 * Transaction History API Route
 * 
 * Uses Alchemy's getAssetTransfers API (more reliable than 1inch History API)
 * 1inch History API requires premium tier access and often returns 404
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const chainId = searchParams.get("chainId");
    const address = searchParams.get("address");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!chainId || !/^\d+$/.test(chainId)) {
        return NextResponse.json({ error: "Invalid or missing chainId" }, { status: 400 });
    }
    if (!address || !isAddress(address)) {
        return NextResponse.json({ error: "Invalid or missing address" }, { status: 400 });
    }

    // Map chainId to EVMChain
    const chainIdMap: Record<number, string> = {
        1: "ethereum",
        8453: "base",
        42161: "arbitrum",
        10: "optimism",
        137: "polygon",
        56: "bsc",
    };

    const chain = chainIdMap[parseInt(chainId, 10)] as AlchemyChain;
    if (!chain) {
        return NextResponse.json({ error: `Unsupported chainId: ${chainId}` }, { status: 400 });
    }

    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
        return NextResponse.json(
            { error: "Too many requests. Please slow down." },
            { status: 429 },
        );
    }

    const apiKey = process.env.ALCHEMY_API_KEY; // Server-side only
    if (!apiKey) {
      return NextResponse.json(
        { error: "Alchemy API key not configured" },
        { status: 500 }
      );
    }

    try {
        const chainMap: Record<string, string> = {
            ethereum: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
            base: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
            arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
            optimism: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
            polygon: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
            bsc: `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`,
        };

        const apiUrl = chainMap[chain];
        if (!apiUrl) {
            return NextResponse.json(
                { error: `Unsupported chain: ${chain}` },
                { status: 400 }
            );
        }

        // Check short-lived in-memory cache before hitting Alchemy.
        const cached = getCachedHistory(chain, address, limit);
        if (cached) {
            return NextResponse.json({ items: cached });
        }

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "alchemy_getAssetTransfers",
                params: [
                    {
                        fromBlock: "0x0",
                        toBlock: "latest",
                        fromAddress: address,
                        toAddress: address,
                        category: ["external", "erc20", "erc721", "erc1155"],
                        withMetadata: true,
                        excludeZeroValue: false,
                        maxCount: `0x${limit.toString(16)}`,
                        order: "desc",
                    },
                ],
            }),
            // Allow Vercel/Next to cache successful responses briefly per payload.
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            throw new Error(`Alchemy API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`Alchemy API error: ${data.error.message}`);
        }

        const transfers = data.result?.transfers || [];
        
        // Enrich transactions with token metadata and fiat values
        const enrichedTransactions = await Promise.all(
            transfers.map(async (transfer: AlchemyTransfer) => {
                const category = transfer.category || "external";
                const isNative = category === "external";
                const contractAddress = isNative ? undefined : transfer.rawContract?.address;
                
                // Determine transaction type
                let type: "send" | "receive" | "swap" | "approval" | "contractInteraction" = "send";
                if (category === "erc20" || category === "erc721" || category === "erc1155") {
                    // Could be swap, approval, or regular transfer - we'll detect swaps later
                    type = "send";
                } else if (category === "external") {
                    // Check if it's a contract interaction
                    const toAddress = transfer.to?.toLowerCase();
                    if (toAddress && toAddress !== transfer.from?.toLowerCase()) {
                        // Could be contract interaction - simplified for now
                        type = "send";
                    }
                }

                // Get token metadata if ERC20
                let tokenSymbol = transfer.asset || (isNative ? "ETH" : "TOKEN");
                let tokenDecimals = isNative ? 18 : undefined;
                
                if (!isNative && contractAddress) {
                    try {
                        // Fetch token metadata via API route
                        const metadataResponse = await fetch(
                            `${req.nextUrl.origin}/api/alchemy/token-metadata`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    contractAddress,
                                    chain,
                                }),
                            }
                        );
                        
                        if (metadataResponse.ok) {
                            const metadataData = await metadataResponse.json();
                            if (metadataData.metadata) {
                                tokenSymbol = metadataData.metadata.symbol || tokenSymbol;
                                tokenDecimals = metadataData.metadata.decimals || 18;
                            }
                        }
                    } catch (error) {
                        console.warn("Failed to fetch token metadata:", error);
                    }
                }

                // Calculate fiat value (simplified - uses current price)
                // In production, you'd want historical prices
                let fiatValue: number | undefined;
                if (transfer.value && tokenDecimals) {
                    try {
                        const valueBigInt = BigInt(transfer.value);
                        const amount = Number(valueBigInt) / Math.pow(10, tokenDecimals);
                        
                        // Fetch current price for fiat value estimate
                        // Note: This is an estimate - real historical prices would be better
                        if (tokenSymbol && tokenSymbol !== "ETH") {
                            try {
                                const priceResponse = await fetch(
                                    `${req.nextUrl.origin}/api/token/analytics?symbol=${tokenSymbol}&chain=${chain}`
                                );
                                if (priceResponse.ok) {
                                    const priceData = await priceResponse.json();
                                    if (priceData.analytics?.currentPriceUsd) {
                                        fiatValue = amount * priceData.analytics.currentPriceUsd;
                                    }
                                }
                            } catch (_error) {
                                // Ignore price fetch errors
                            }
                        } else if (tokenSymbol === "ETH") {
                            // For ETH, use a rough estimate (in production, use historical price API)
                            // For now, we'll leave fiatValue undefined and calculate on frontend
                        }
                    } catch (error) {
                        console.warn("Failed to calculate fiat value:", error);
                    }
                }

                return {
                    hash: transfer.hash,
                    from: transfer.from,
                    to: transfer.to,
                    value: transfer.value || "0",
                    asset: transfer.asset,
                    category: transfer.category,
                    timestamp: transfer.metadata?.blockTimestamp 
                        ? new Date(transfer.metadata.blockTimestamp).getTime()
                        : Date.now(),
                    blockNum: transfer.blockNum || "0x0",
                    // Enriched fields
                    tokenSymbol,
                    tokenDecimals,
                    fiatValue,
                    fiatCurrency: "USD",
                    type,
                };
            })
        );

        // Store in best-effort in-memory cache to protect upstream RPCs.
        setCachedHistory(chain, address, limit, enrichedTransactions);

        return NextResponse.json({ items: enrichedTransactions });
      } catch (error: unknown) {
        let message = "Failed to fetch transaction history";
        if (error instanceof Error) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }
        console.error("Transaction history error:", error);
        return NextResponse.json(
          { 
            error: message,
            hint: "Make sure NEXT_PUBLIC_ALCHEMY_API_KEY is configured"
          },
          { status: 500 }
        );
      }}

