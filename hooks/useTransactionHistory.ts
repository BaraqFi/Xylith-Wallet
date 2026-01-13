import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { WalletTransaction, Chain, EVMChain, WalletDirection } from "@/components/wallet/data";
import { formatUnits } from "viem";
import { getCachedData, setCachedData } from "@/lib/utils/cache";

// Cache TTL: 5 minutes for transaction history (less frequent changes)
const HISTORY_CACHE_TTL = 5 * 60 * 1000;

// Note: Now using Alchemy's getAssetTransfers API instead of 1inch History API
// 1inch is only used for swaps, not transaction history

export function useTransactionHistory(activeChain: Chain, currentEvmChain: EVMChain) {
    const { user } = usePrivy();
    const address = user?.wallet?.address;

    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Use ref to track if we're currently fetching to prevent duplicate requests
    const fetchingRef = useRef(false);
    // Use ref to track last fetch time per address+chain combo
    const lastFetchRef = useRef<{ address: string; chain: string; timestamp: number } | null>(null);

    useEffect(() => {
        async function fetchHistory() {
            // Logic: Only fetch if EVM and address exists
            // If Local Fork environment (dev + ethereum/localhost), we can't reliably get history from 1inch.
            // So we return empty or "Local Transactions Not Indexed".
            // We will skip fetch for now if process.env.NODE_ENV === development AND chain is 'ethereum' (assuming local fork)
            // Actually, user might want to see real Mainnet history even in dev?
            // Let's try to fetch.

            if (!address || activeChain !== "EVM") {
                setTransactions([]);
                return;
            }

            // Check cache first
            const cacheKey = `xylith_cache_history_${address.toLowerCase()}_${currentEvmChain}`;
            const cached = getCachedData<WalletTransaction[]>(cacheKey, HISTORY_CACHE_TTL);
            
            if (cached) {
                setTransactions(cached);
                setIsLoading(false);
                // Still fetch in background to update cache, but don't show loading
                // Only if we haven't fetched recently (avoid duplicate requests)
                const lastFetch = lastFetchRef.current;
                const shouldFetch = !lastFetch || 
                    lastFetch.address !== address.toLowerCase() ||
                    lastFetch.chain !== currentEvmChain ||
                    Date.now() - lastFetch.timestamp > HISTORY_CACHE_TTL;
                
                if (!shouldFetch || fetchingRef.current) {
                    return;
                }
            } else {
                setIsLoading(true);
            }

            // Prevent duplicate concurrent requests
            if (fetchingRef.current) {
                return;
            }
            fetchingRef.current = true;
            setError(null);

            // Map chain to ID
            let chainId = 1;
            switch (currentEvmChain) {
                case 'ethereum': chainId = 1; break;
                case 'base': chainId = 8453; break;
                case 'arbitrum': chainId = 42161; break;
                case 'optimism': chainId = 10; break;
                case 'polygon': chainId = 137; break;
                case 'bsc': chainId = 56; break;
                default:
                    console.warn(`Unrecognized EVM chain: ${currentEvmChain}`);
                    setError(`Unsupported chain: ${currentEvmChain}`);
                    setIsLoading(false);
                    return;
            }

            try {
                const params = new URLSearchParams({
                    chainId: chainId.toString(),
                    address: address,
                    limit: "20"
                });

                // Use Alchemy-based transaction history API (more reliable than 1inch)
                const res = await fetch(`/api/transactions/history?${params.toString()}`);
                const data = await res.json();
                
                if (!res.ok) {
                    // Handle errors gracefully
                    if (res.status === 404 || res.status === 500) {
                        // If Alchemy API key not configured or other error, return empty
                        console.warn("Transaction history unavailable:", data.error || "Unknown error");
                        setTransactions([]);
                        setCachedData(cacheKey, []);
                        lastFetchRef.current = {
                            address: address.toLowerCase(),
                            chain: currentEvmChain,
                            timestamp: Date.now(),
                        };
                        return;
                    }
                    // For other errors, throw
                    throw new Error(data.error || "Failed to fetch history");
                }
                const items: any[] = data.items || [];

                // Map Alchemy Transaction History Items to WalletTransaction
                // Alchemy's getAssetTransfers returns transfers with metadata
                // Map Alchemy transaction items to WalletTransaction format
                // Alchemy returns transfers with: hash, from, to, value, asset, category, timestamp, blockNum
                const mapped: WalletTransaction[] = items.map((item: any, idx: number) => {
                    const normalize = (addr?: string) => (addr || "").toLowerCase();
                    const normalizedUser = normalize(address);
                    const fromAddr = normalize(item.from);
                    const toAddr = normalize(item.to);

                    // Determine direction based on address
                    const direction: WalletDirection = 
                        toAddr === normalizedUser
                            ? "in"
                            : fromAddr === normalizedUser
                                ? "out"
                                : "unknown";

                    // Determine action type from enriched type or category
                    const category = item.category || "external";
                    const enrichedType = item.type;
                    
                    // Use enriched type if available, otherwise infer from category and direction
                    let action: "Send" | "Receive" | "Swap";
                    if (enrichedType === "swap") {
                        action = "Swap";
                    } else {
                        action = direction === "in" ? "Receive" : "Send";
                    }

                    // Parse timestamp (Alchemy returns milliseconds)
                    const timestampMs = item.timestamp || Date.now();
                    const timestampLabel = new Date(timestampMs).toLocaleString();

                    // Parse value - Alchemy returns hex string for value
                    const valueHex = item.value || "0x0";
                    const tokenSymbol = item.asset || (category === "external" ? "ETH" : "TOKEN");
                    
                    // Format amount with enriched data
                    let tokenAmount = "0";
                    let amountLabel = "0";
                    
                    try {
                        const decimals = item.tokenDecimals || (category === "external" ? 18 : 18);
                        const valueBigInt = BigInt(valueHex);
                        tokenAmount = formatUnits(valueBigInt, decimals).toString();
                        
                        // Use enriched token symbol if available
                        const displaySymbol = item.tokenSymbol || tokenSymbol;
                        const amountNum = parseFloat(tokenAmount);
                        
                        // Format amount with appropriate precision
                        const formattedAmount = amountNum >= 1 
                            ? amountNum.toFixed(4)
                            : amountNum.toFixed(6);
                        
                        // Build amount label with fiat value if available
                        if (item.fiatValue !== undefined && item.fiatValue > 0) {
                            const fiatFormatted = item.fiatValue >= 1
                                ? item.fiatValue.toFixed(2)
                                : item.fiatValue.toFixed(4);
                            amountLabel = direction === "in"
                                ? `+${formattedAmount} ${displaySymbol} (~$${fiatFormatted})`
                                : `-${formattedAmount} ${displaySymbol} (~$${fiatFormatted})`;
                        } else {
                            amountLabel = direction === "in"
                                ? `+${formattedAmount} ${displaySymbol}`
                                : `-${formattedAmount} ${displaySymbol}`;
                        }
                    } catch (e) {
                        console.warn("Error parsing transaction value:", e, item);
                        tokenAmount = valueHex;
                        amountLabel = `${valueHex} ${item.tokenSymbol || tokenSymbol}`;
                    }

                    const counterparty = 
                        direction === "in" 
                            ? item.from || "Unavailable"
                            : item.to || "Unavailable";

                    return {
                        id: `${item.hash}_${idx}`, // stable per transfer
                        action: action as "Send" | "Receive" | "Swap",
                        token: tokenSymbol,
                        counterparty,
                        amountLabel,
                        timestampLabel,
                        direction,
                        chain: "EVM",
                        evmChain: currentEvmChain,
                        status: "confirmed", // Alchemy returns confirmed transactions
                        txHash: item.hash,
                        timestamp: timestampMs,
                        fromAddress: item.from || "",
                        toAddress: item.to || "",
                        value: tokenAmount,
                        tokenSymbol,
                        tokenAmount,
                    } as WalletTransaction;
                });

                setTransactions(mapped);
                
                // Cache the result
                setCachedData(cacheKey, mapped);
                lastFetchRef.current = {
                    address: address.toLowerCase(),
                    chain: currentEvmChain,
                    timestamp: Date.now(),
                };

            } catch (err: any) {
                console.error("History Fetch Error:", err);
                
                // Handle 404 gracefully - it might just mean no history exists
                if (err?.message?.includes("404") || err?.message?.includes("Not Found")) {
                    setError(null); // Don't show error for 404, just empty list
                    setTransactions([]);
                    // Cache empty result to avoid repeated 404s
                    setCachedData(cacheKey, []);
                } else {
                    setError("Failed to load history");
                    // On error, try to use cached data if available
                    const cached = getCachedData<WalletTransaction[]>(cacheKey, HISTORY_CACHE_TTL * 2); // Use stale cache on error
                    if (cached) {
                        setTransactions(cached);
                    }
                }
            } finally {
                setIsLoading(false);
                fetchingRef.current = false;
            }
        }

        fetchHistory();
    }, [address, activeChain, currentEvmChain]);

    return { transactions, isLoading, error };
}

function mapTypeToAction(type: string): "Send" | "Receive" | "Swap" {
    if (type === "swap") return "Swap";
    if (type === "transfer" || type === "transfer_from") return "Send"; // direction determined separately
    return "Send"; // default
}
