import { useState, useEffect, useRef, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { WalletTransaction, Chain, EVMChain, WalletDirection } from "@/components/wallet/data";
import { formatUnits } from "viem";
import { getCachedData, setCachedData } from "@/lib/utils/cache";

// Cache TTL: 30 seconds for transaction history (more frequent updates for payments)
const HISTORY_CACHE_TTL = 30 * 1000;

// Note: Now using Alchemy's getAssetTransfers API instead of 1inch History API
// 1inch is only used for swaps, not transaction history

export function useTransactionHistory(activeChain: Chain, currentEvmChain: EVMChain) {
    const { user } = usePrivy();

    // Always derive BOTH EVM and Solana addresses up-front from Privy.
    // This lets us fetch history for both chains on initialization,
    // without waiting for an "active chain" toggle.
    const { evmAddress, solAddress } = useMemo(() => {
        if (!user?.linkedAccounts) {
            return { evmAddress: undefined, solAddress: undefined } as {
                evmAddress?: string;
                solAddress?: string;
            };
        }

        const evmAcc = user.linkedAccounts.find(
            (a) => a.type === "wallet" && (a as any).chainType === "ethereum",
        );
        const solAcc = user.linkedAccounts.find(
            (a) => a.type === "wallet" && (a as any).chainType === "solana",
        );

        return {
            evmAddress: evmAcc ? (evmAcc as any).address : undefined,
            solAddress: solAcc ? (solAcc as any).address : undefined,
        };
    }, [user]);

    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use ref to track if we're currently fetching to prevent duplicate requests
    const fetchingRef = useRef(false);
    // Track last fetch time per address-combination + chain
    const lastFetchRef = useRef<{ key: string; timestamp: number } | null>(null);

    useEffect(() => {
        async function fetchHistory() {
            if (!evmAddress && !solAddress) {
                setTransactions([]);
                return;
            }

            const lowerEvm = evmAddress?.toLowerCase() || "none";
            const lowerSol = solAddress?.toLowerCase() || "none";
            const cacheKey = `xylith_cache_history_${lowerEvm}_${lowerSol}_${currentEvmChain}`;

            const cached = getCachedData<WalletTransaction[]>(cacheKey, HISTORY_CACHE_TTL);

            if (cached) {
                setTransactions(cached);
                setIsLoading(false);
                const lastFetch = lastFetchRef.current;
                const shouldFetch =
                    !lastFetch ||
                    lastFetch.key !== cacheKey ||
                    Date.now() - lastFetch.timestamp > HISTORY_CACHE_TTL;

                if (!shouldFetch || fetchingRef.current) {
                    return;
                }
            } else {
                setIsLoading(true);
            }

            if (fetchingRef.current) {
                return;
            }
            fetchingRef.current = true;
            setError(null);

            try {
                const tasks: Promise<WalletTransaction[]>[] = [];

                // --- EVM HISTORY TASK ---
                if (evmAddress) {
                    // Map chain to ID
                    let chainId = 1;
                    switch (currentEvmChain) {
                        case "ethereum":
                            chainId = 1;
                            break;
                        case "base":
                            chainId = 8453;
                            break;
                        case "arbitrum":
                            chainId = 42161;
                            break;
                        case "optimism":
                            chainId = 10;
                            break;
                        case "polygon":
                            chainId = 137;
                            break;
                        case "bsc":
                            chainId = 56;
                            break;
                        default:
                            console.warn(`Unrecognized EVM chain: ${currentEvmChain}`);
                            break;
                    }

                    tasks.push(
                        (async (): Promise<WalletTransaction[]> => {
                            try {
                                const params = new URLSearchParams({
                                    chainId: chainId.toString(),
                                    address: evmAddress,
                                    limit: "20",
                                });

                                const res = await fetch(
                                    `/api/transactions/history?${params.toString()}`,
                                );
                                const data = await res.json();

                                if (!res.ok) {
                                    if (res.status === 404 || res.status === 500) {
                                        console.warn(
                                            "EVM transaction history unavailable:",
                                            data.error || "Unknown error",
                                        );
                                        return [];
                                    }
                                    throw new Error(data.error || "Failed to fetch history");
                                }

                                const items: any[] = data.items || [];

                                const mapped: WalletTransaction[] = items.map(
                                    (item: any, idx: number) => {
                                        const normalize = (addr?: string) =>
                                            (addr || "").toLowerCase();
                                        const normalizedUser = normalize(evmAddress);
                                        const fromAddr = normalize(item.from);
                                        const toAddr = normalize(item.to);

                                        const direction: WalletDirection =
                                            toAddr === normalizedUser
                                                ? "in"
                                                : fromAddr === normalizedUser
                                                ? "out"
                                                : "unknown";

                                        const category = item.category || "external";
                                        const enrichedType = item.type;

                                        let action: "Send" | "Receive" | "Swap";
                                        if (enrichedType === "swap") {
                                            action = "Swap";
                                        } else {
                                            action =
                                                direction === "in" ? "Receive" : "Send";
                                        }

                                        const timestampMs =
                                            item.timestamp || Date.now();
                                        const timestampLabel = new Date(
                                            timestampMs,
                                        ).toLocaleString();

                                        const rawValue = item.value ?? "0";
                                        const tokenSymbol =
                                            item.asset ||
                                            (category === "external" ? "ETH" : "TOKEN");

                                        let tokenAmount = "0";
                                        let amountLabel = "0";

                                        try {
                                            // /api/transactions/history passes through Alchemy
                                            // getAssetTransfers, whose `value` is already a
                                            // decimal amount in token units (e.g. 0.0004) —
                                            // NOT wei. BigInt() on it throws. Keep the hex-wei
                                            // path only for a source that actually sends hex.
                                            const decimals = item.tokenDecimals || 18;
                                            const amountNum =
                                                typeof rawValue === "string" &&
                                                rawValue.startsWith("0x")
                                                    ? parseFloat(
                                                          formatUnits(
                                                              BigInt(rawValue),
                                                              decimals,
                                                          ),
                                                      )
                                                    : Number(rawValue);
                                            if (!Number.isFinite(amountNum)) {
                                                throw new Error(
                                                    `Unparseable transfer value: ${rawValue}`,
                                                );
                                            }
                                            tokenAmount = String(amountNum);

                                            const displaySymbol =
                                                item.tokenSymbol || tokenSymbol;

                                            const formattedAmount =
                                                amountNum >= 1
                                                    ? amountNum.toFixed(4)
                                                    : amountNum.toFixed(6);

                                            if (
                                                item.fiatValue !== undefined &&
                                                item.fiatValue > 0
                                            ) {
                                                const fiatFormatted =
                                                    item.fiatValue >= 1
                                                        ? item.fiatValue.toFixed(2)
                                                        : item.fiatValue.toFixed(4);
                                                amountLabel =
                                                    direction === "in"
                                                        ? `+${formattedAmount} ${displaySymbol} (~$${fiatFormatted})`
                                                        : `-${formattedAmount} ${displaySymbol} (~$${fiatFormatted})`;
                                            } else {
                                                amountLabel =
                                                    direction === "in"
                                                        ? `+${formattedAmount} ${displaySymbol}`
                                                        : `-${formattedAmount} ${displaySymbol}`;
                                            }
                                        } catch (e) {
                                            console.warn(
                                                "Error parsing transaction value:",
                                                e,
                                                item,
                                            );
                                            tokenAmount = String(rawValue);
                                            amountLabel = `${rawValue} ${
                                                item.tokenSymbol || tokenSymbol
                                            }`;
                                        }

                                        const counterparty =
                                            direction === "in"
                                                ? item.from || "Unavailable"
                                                : item.to || "Unavailable";

                                        return {
                                            id: `${item.hash}_${idx}`,
                                            action,
                                            token: tokenSymbol,
                                            counterparty,
                                            amountLabel,
                                            timestampLabel,
                                            direction,
                                            chain: "EVM",
                                            evmChain: currentEvmChain,
                                            status: "confirmed",
                                            txHash: item.hash,
                                            timestamp: timestampMs,
                                            fromAddress: item.from || "",
                                            toAddress: item.to || "",
                                            value: tokenAmount,
                                            tokenSymbol,
                                            tokenAmount,
                                        } as WalletTransaction;
                                    },
                                );

                                return mapped;
                            } catch (err) {
                                console.error("EVM History Fetch Error:", err);
                                return [];
                            }
                        })(),
                    );
                }

                // --- SOLANA HISTORY TASK ---
                if (solAddress) {
                    tasks.push(
                        (async (): Promise<WalletTransaction[]> => {
                            try {
                                const sigRes = await fetch("/api/rpc?chain=solana", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        method: "getSignaturesForAddress",
                                        params: [solAddress, { limit: 20 }],
                                    }),
                                });

                                const sigJson = await sigRes.json();
                                if (!sigRes.ok || sigJson.error) {
                                    throw new Error(
                                        sigJson.error?.message ||
                                            "Failed to fetch Solana signatures",
                                    );
                                }

                                const signatures: any[] = sigJson.result || [];

                                const txResults = await Promise.all(
                                    signatures.map(async (sigInfo, idx) => {
                                        const signature =
                                            sigInfo.signature || sigInfo;
                                        try {
                                            const txRes = await fetch(
                                                "/api/rpc?chain=solana",
                                                {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type":
                                                            "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        method: "getTransaction",
                                                        params: [
                                                            signature,
                                                            {
                                                                encoding:
                                                                    "jsonParsed",
                                                                maxSupportedTransactionVersion:
                                                                    0,
                                                            },
                                                        ],
                                                    }),
                                                },
                                            );
                                            const txJson = await txRes.json();
                                            if (!txRes.ok || txJson.error) {
                                                return null;
                                            }
                                            return {
                                                tx: txJson.result,
                                                sigInfo,
                                                idx,
                                            };
                                        } catch {
                                            return null;
                                        }
                                    }),
                                );

                                const mappedSol: WalletTransaction[] = [];
                                const userAddrLower = solAddress.toLowerCase();

                                for (const entry of txResults) {
                                    if (!entry || !entry.tx) continue;
                                    const { tx, sigInfo, idx } = entry as any;

                                    const meta = tx.meta;
                                    const transaction = tx.transaction;
                                    if (!meta || !transaction) continue;

                                    const accountKeys: string[] =
                                        transaction.message?.accountKeys?.map(
                                            (k: any) =>
                                                (typeof k === "string"
                                                    ? k
                                                    : k.pubkey) as string,
                                        ) || [];
                                    const preBalances: number[] =
                                        meta.preBalances || [];
                                    const postBalances: number[] =
                                        meta.postBalances || [];

                                    const userIndex = accountKeys.findIndex(
                                        (k) => k.toLowerCase() === userAddrLower,
                                    );
                                    if (userIndex === -1) continue;

                                    const pre = preBalances[userIndex] ?? 0;
                                    const post = postBalances[userIndex] ?? 0;
                                    const deltaLamports = post - pre;

                                    if (deltaLamports === 0) {
                                        continue;
                                    }

                                    const direction: WalletDirection =
                                        deltaLamports > 0 ? "in" : "out";
                                    const amountSol =
                                        Math.abs(deltaLamports) / 1e9;

                                    const formattedAmount =
                                        amountSol >= 1
                                            ? amountSol.toFixed(4)
                                            : amountSol.toFixed(6);
                                    const amountLabel =
                                        direction === "in"
                                            ? `+${formattedAmount} SOL`
                                            : `-${formattedAmount} SOL`;

                                    const blockTimeSec: number | undefined =
                                        tx.blockTime;
                                    const timestampMs = blockTimeSec
                                        ? blockTimeSec * 1000
                                        : Date.now();
                                    const timestampLabel = new Date(
                                        timestampMs,
                                    ).toLocaleString();

                                    const counterparty =
                                        accountKeys.find(
                                            (k) =>
                                                k.toLowerCase() !==
                                                userAddrLower,
                                        ) || "Unknown";

                                    const status: WalletTransaction["status"] =
                                        meta.err ? "failed" : "confirmed";

                                    mappedSol.push({
                                        id: `${
                                            tx.transaction?.signatures?.[0] ??
                                            sigInfo.signature
                                        }_${idx}`,
                                        action:
                                            direction === "in"
                                                ? "Receive"
                                                : "Send",
                                        token: "SOL",
                                        counterparty,
                                        amountLabel,
                                        timestampLabel,
                                        direction,
                                        chain: "Solana",
                                        evmChain: undefined,
                                        status,
                                        txHash:
                                            tx.transaction?.signatures?.[0] ??
                                            sigInfo.signature,
                                        timestamp: timestampMs,
                                        fromAddress: accountKeys[0] || "",
                                        toAddress: counterparty,
                                        value: amountSol.toString(),
                                        tokenSymbol: "SOL",
                                        tokenAmount: amountSol.toString(),
                                    });
                                }

                                return mappedSol;
                            } catch (err) {
                                console.error(
                                    "Solana History Fetch Error:",
                                    err,
                                );
                                return [];
                            }
                        })(),
                    );
                }

                const results = await Promise.all(tasks);
                const combined = results.flat();

                // Sort newest -> oldest by timestamp
                combined.sort((a, b) => b.timestamp - a.timestamp);

                setTransactions(combined);
                setCachedData(cacheKey, combined);
                lastFetchRef.current = {
                    key: cacheKey,
                    timestamp: Date.now(),
                };
            } catch (err: any) {
                console.error("History Fetch Error:", err);
                setError("Failed to load history");

                const lowerEvm = evmAddress?.toLowerCase() || "none";
                const lowerSol = solAddress?.toLowerCase() || "none";
                const fallbackKey = `xylith_cache_history_${lowerEvm}_${lowerSol}_${currentEvmChain}`;
                const cached = getCachedData<WalletTransaction[]>(
                    fallbackKey,
                    HISTORY_CACHE_TTL * 2,
                );
                if (cached) {
                    setTransactions(cached);
                }
            } finally {
                setIsLoading(false);
                fetchingRef.current = false;
            }
        }

        fetchHistory();
        // We intentionally do NOT depend on activeChain for fetching,
        // so that both EVM and Solana history are aggregated eagerly.
    }, [evmAddress, solAddress, currentEvmChain]);

    return { transactions, isLoading, error };
}

function mapTypeToAction(type: string): "Send" | "Receive" | "Swap" {
    if (type === "swap") return "Swap";
    if (type === "transfer" || type === "transfer_from") return "Send"; // direction determined separately
    return "Send"; // default
}
