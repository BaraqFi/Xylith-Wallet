import { useState, useEffect } from "react";
import { ultraClient } from "@/lib/ultra/client";
import { TokenBalance } from "@/components/wallet/data";

// Simple debounce hook
function useLocalDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export function useSolanaSwapQuote({
    fromToken,
    toToken,
    amount,
    fromAddress,
    slippage,
}: {
    fromToken: TokenBalance | null;
    toToken: TokenBalance | null;
    amount: string;
    fromAddress?: string;
    slippage: number;
}) {
    const [quote, setQuote] = useState<any | null>(null); // Ultra order response
    const [swapTx, setSwapTx] = useState<string | null>(null); // Base64 unsigned transaction from Ultra
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debouncedAmount = useLocalDebounce(amount, 500);

    useEffect(() => {
        let cancelled = false;

        async function fetchQuote() {
            // Reset state
            setQuote(null);
            setSwapTx(null);
            setError(null);

            if (!fromToken || !toToken || !debouncedAmount) {
                return;
            }

            const parsedAmount = Number(debouncedAmount);
            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                return;
            }

            if (fromToken.chain !== 'Solana' || toToken.chain !== 'Solana') {
                return;
            }

            const inputMint = fromToken.contractAddress;
            const outputMint = toToken.contractAddress;

            if (!inputMint || !outputMint) {
                setError("Missing contract address for token");
                return;
            }

            // Basic Solana address validation for taker if provided
            const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

            // If balance is insufficient, DON'T pass taker to avoid simulation failure on Ultra API
            const hasInsufficientBalance = (fromToken.amount || 0) < parsedAmount;

            const taker =
                fromAddress && SOLANA_ADDRESS_REGEX.test(fromAddress) && !hasInsufficientBalance
                    ? fromAddress
                    : undefined;

            setIsLoading(true);

            try {
                // Convert amount to atomic units (lamports/smallest unit)
                const decimals = fromToken.decimals ?? 9;
                const scaled = parsedAmount * Math.pow(10, decimals);
                const amountUnits = Math.floor(scaled).toString();

                const orderData = await ultraClient.getOrder({
                    inputMint,
                    outputMint,
                    amount: amountUnits,
                    taker,
                });

                if (cancelled) return;

                if (!orderData || orderData.error) {
                    throw new Error(orderData?.error || "Failed to fetch Ultra order");
                }

                setQuote(orderData);
                if (orderData.transaction && typeof orderData.transaction === "string") {
                    setSwapTx(orderData.transaction);
                }

            } catch (err: any) {
                if (!cancelled) {
                    // Try to extract detailed error info
                    const msg = err.message || "Failed to fetch quote";
                    console.error("Solana Ultra order error:", msg, err);
                    setError(msg);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchQuote();

        return () => { cancelled = true; };
        // fromAddress matters: Ultra only returns a signable transaction when a
        // taker is present, and the wallet list loads asynchronously.
    }, [fromToken, toToken, debouncedAmount, slippage, fromAddress]);

    // Function to fetch the actual swap transaction
    const fetchSwapTransaction = async () => {
        if (!swapTx) {
            throw new Error("No Ultra order transaction available");
        }
        return swapTx;
    };

    return { quote, swapTx, isLoading, error, fetchSwapTransaction };
}
