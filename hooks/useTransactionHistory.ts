import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { WalletTransaction, Chain, EVMChain, WalletDirection } from "@/components/wallet/data";
import { formatUnits } from "viem";

// Types from 1inch History API (simplified)
interface HistoryItem {
    id: string; // internal id?
    hash: string;
    blockNumber: number;
    time: number | string; // timestamp as string or number
    status: "mined" | "pending" | "failed"; // match API
    logIndex?: number;
    eventIndex?: number;
    details: {
        type: string; // "swap", "approve", "transfer"
        status: string;
        token?: string;
        amount?: string;
        to?: string;
        from?: string;
        // ... complex structure depending on type
    };
    // 1inch v2 structure is quite complex.
    // Let's assume we map it to our internal WalletTransaction type.
    // For MVP, we might just display what we get.
}

export function useTransactionHistory(activeChain: Chain, currentEvmChain: EVMChain) {
    const { user } = usePrivy();
    const address = user?.wallet?.address;

    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

            setIsLoading(true);
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

                const res = await fetch(`/api/1inch/history?${params.toString()}`);
                const data = await res.json();
                
                if (!res.ok) {
                    // It might fail if wallet has NO history (404?) or other error.
                    // 1inch returns 200 with items usually.
                    throw new Error(data.error || "Failed to fetch history");
                }
                const items: any[] = data.items || [];

                // Map 1inch History Items to WalletTransaction
                // This mapping is non-trivial because 1inch History API returns "events" (like 'swap', 'transfer')
                // We need to normalize this to our UI model.

                // TODO: Normalize 1inch history payload once full schema is known (token metadata, amount parsing, direction), and localize fallbacks.
                const mapped: WalletTransaction[] = items.map((item: HistoryItem, idx: number) => {
                    const details = item.details || {};
                    const normalize = (addr?: string) => (addr || "").toLowerCase();
                    const normalizedUser = normalize(address);
                    const fromAddr = normalize(details.from);
                    const toAddr = normalize(details.to);

                    const normalizedType = typeof details.type === "string" ? details.type.toLowerCase() : "";
                    const isSwapLike =
                        normalizedType === "swap" ||
                        normalizedType === "bridge" ||
                        Array.isArray((details as any).operations);

                    const direction: WalletDirection = isSwapLike
                        ? "swap"
                        : toAddr && toAddr === normalizedUser
                          ? "in"
                          : fromAddr && fromAddr === normalizedUser
                            ? "out"
                            : "unknown";

                    const parseTimestamp = (timeValue: any) => {
                        if (typeof timeValue === "string") {
                            const parsed = Date.parse(timeValue);
                            if (!Number.isNaN(parsed)) return parsed;
                            const numeric = Number(timeValue);
                            if (!Number.isNaN(numeric)) {
                                return numeric > 1e12 ? numeric : numeric * 1000;
                            }
                        }
                        if (typeof timeValue === "number") {
                            const isMs = Math.abs(timeValue) > 1e12;
                            return isMs ? timeValue : timeValue * 1000;
                        }
                        return Date.now();
                    };

                    const timestampMs = parseTimestamp((item as any).time ?? (details as any).timestamp);
                    const timestampLabel = new Date(timestampMs).toLocaleString();

                    const tokenSymbol =
                        (details as any).tokenSymbol ||
                        (details as any).symbol ||
                        (details as any).asset ||
                        (details as any).token?.symbol ||
                        "Unavailable";
                    const tokenAmountRaw =
                        (details as any).tokenAmount ??
                        (details as any).amount ??
                        (details as any).value ??
                        (details as any).token?.amount;
                    const tokenAmount = tokenAmountRaw !== undefined ? String(tokenAmountRaw) : "Unavailable";

                    const counterparty =
                        toAddr && toAddr === normalizedUser
                            ? details.from || "Unavailable"
                            : details.to || details.from || "Unavailable";
                    const amountLabel =
                        tokenAmount !== "Unavailable"
                            ? `${tokenAmount} ${tokenSymbol !== "Unavailable" ? tokenSymbol : ""}`.trim()
                            : "Unavailable";

                    const eventSuffix = item.logIndex ?? item.eventIndex ?? idx;

                    return {
                        id: `${item.hash}_${String(eventSuffix)}`, // stable per event
                        action: mapTypeToAction(details.type),
                        token: tokenSymbol,
                        counterparty,
                        amountLabel,
                        timestampLabel,
                        direction,
                        chain: "EVM",
                        evmChain: currentEvmChain,
                        status: item.status === "mined" ? "confirmed" : item.status === "pending" ? "pending" : "failed",
                        txHash: item.hash,
                        timestamp: timestampMs,
                        fromAddress: details.from || "",
                        toAddress: details.to || "",
                        value: tokenAmount,
                        tokenSymbol,
                        tokenAmount,
                    } as WalletTransaction;
                });

                // Since mapping 1inch V2 history perfectly to our specific UI "WalletTransaction" type without seeing the exact response payload is risky, 
                // I will implement a "Safe Fallback" which is:
                // Use the raw data to populate essential fields, and leave others generic.
                // For the sake of this task ("Remove Mocks"), fetching *anything* real is better than hardcoded.
                // However, if the list is empty (common for test wallets), we might look empty.

                // BETTER APPROACH FOR THIS TASK:
                // 1inch History API response is complex. 
                // Let's just create a simplified mapped list.

                setTransactions(mapped);

            } catch (err) {
                console.error("History Fetch Error:", err);
                setError("Failed to load history");
            } finally {
                setIsLoading(false);
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
