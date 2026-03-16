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

        // To get a complete history we need BOTH:
        // - outgoing transfers (fromAddress = user)
        // - incoming transfers (toAddress = user)
        //
        // Alchemy's getAssetTransfers treats fromAddress + toAddress as an AND filter,
        // so we must query them separately and then merge.
        const requestBodyBase = {
            id: 1,
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [
                {
                    fromBlock: "0x0",
                    toBlock: "latest",
                    category: ["external", "erc20", "erc721", "erc1155"],
                    withMetadata: true,
                    excludeZeroValue: false,
                    maxCount: `0x${limit.toString(16)}`,
                    order: "desc",
                },
            ],
        };

        const [outgoingRes, incomingRes] = await Promise.all([
            fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...requestBodyBase,
                    params: [
                        {
                            ...(requestBodyBase.params[0] as any),
                            fromAddress: address,
                        },
                    ],
                }),
                next: { revalidate: 60 },
            }),
            fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...requestBodyBase,
                    params: [
                        {
                            ...(requestBodyBase.params[0] as any),
                            toAddress: address,
                        },
                    ],
                }),
                next: { revalidate: 60 },
            }),
        ]);

        if (!outgoingRes.ok) {
            throw new Error(`Alchemy API error (outgoing): ${outgoingRes.statusText}`);
        }
        if (!incomingRes.ok) {
            throw new Error(`Alchemy API error (incoming): ${incomingRes.statusText}`);
        }

        const outgoingData = await outgoingRes.json();
        const incomingData = await incomingRes.json();

        if (outgoingData.error) {
            throw new Error(`Alchemy API error (outgoing): ${outgoingData.error.message}`);
        }
        if (incomingData.error) {
            throw new Error(`Alchemy API error (incoming): ${incomingData.error.message}`);
        }

        const outgoingTransfers: AlchemyTransfer[] = outgoingData.result?.transfers || [];
        const incomingTransfers: AlchemyTransfer[] = incomingData.result?.transfers || [];

        // Merge and de-duplicate transfers. We key by a combination of fields
        // that uniquely identify a transfer.
        const transferMap = new Map<string, AlchemyTransfer>();

        const addTransfers = (items: AlchemyTransfer[]) => {
            for (const t of items) {
                const key = [
                    t.hash,
                    t.from || "",
                    t.to || "",
                    t.value || "",
                    t.asset || "",
                    t.blockNum,
                ].join(":");
                if (!transferMap.has(key)) {
                    transferMap.set(key, t);
                }
            }
        };

        addTransfers(outgoingTransfers);
        addTransfers(incomingTransfers);

        const mergedTransfers = Array.from(transferMap.values());

        // Sort newest → oldest by block timestamp if available
        mergedTransfers.sort((a, b) => {
            const aTime = a.metadata?.blockTimestamp
                ? new Date(a.metadata.blockTimestamp).getTime()
                : 0;
            const bTime = b.metadata?.blockTimestamp
                ? new Date(b.metadata.blockTimestamp).getTime()
                : 0;
            return bTime - aTime;
        });
        
        // Enrich transactions with token metadata and fiat values
        const enrichedTransactions = await Promise.all(
            mergedTransfers.map(async (transfer: AlchemyTransfer) => {
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
                // NOTE: Alchemy `getAssetTransfers` returns `value` already in token units (may be decimal).
                // So we should not BigInt() it (would throw for values like "0.0004").
                let fiatValue: number | undefined;
                if (transfer.value) {
                    try {
                        const amount = Number(transfer.value);
                        if (!Number.isFinite(amount)) throw new Error("Non-numeric transfer value");
                        
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

