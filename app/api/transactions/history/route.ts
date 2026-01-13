import { NextRequest, NextResponse } from "next/server";

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

    if (!chainId) {
        return NextResponse.json({ error: "Missing chainId" }, { status: 400 });
    }
    if (!address) {
        return NextResponse.json({ error: "Missing address" }, { status: 400 });
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

    const chain = chainIdMap[parseInt(chainId, 10)] as any;
    if (!chain) {
        return NextResponse.json({ error: `Unsupported chainId: ${chainId}` }, { status: 400 });
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
            transfers.map(async (transfer: any) => {
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
                            } catch (error) {
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

        return NextResponse.json({ items: enrichedTransactions });
    } catch (error: any) {
        console.error("Transaction history error:", error);
        return NextResponse.json(
            { 
                error: error.message || "Failed to fetch transaction history",
                hint: "Make sure NEXT_PUBLIC_ALCHEMY_API_KEY is configured"
            },
            { status: 500 }
        );
    }
}

