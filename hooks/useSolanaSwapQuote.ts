import { useState, useEffect } from "react";
import { jupiterClient } from "@/lib/jupiter/client";
import { usePrivy } from "@privy-io/react-auth";
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
    const [quote, setQuote] = useState<any | null>(null);
    const [swapTx, setSwapTx] = useState<string | null>(null); // Base64 transaction
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

            if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
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

            setIsLoading(true);

            try {
                // Convert amount to atomic units (lamports/smallest unit)
                // Need decimals. Default 9 for SOL, 6 for USDC/USDT commonly, usually in token data
                const decimals = fromToken.decimals ?? 9;
                // Careful with float precision. 
                // Best practice: use library or string math. Simple calc for now:
                const amountIds = Math.floor(parseFloat(debouncedAmount) * Math.pow(10, decimals)).toString();

                const quoteData = await jupiterClient.getQuote({
                    inputMint,
                    outputMint,
                    amount: amountIds,
                    slippageBps: slippage * 100, // 1% = 100 bps
                });

                if (cancelled) return;

                if (!quoteData || quoteData.error) {
                    throw new Error(quoteData?.error || "Failed to fetch quote");
                }

                setQuote(quoteData);

            } catch (err: any) {
                if (!cancelled) {
                    console.error("Solana quote error:", err);
                    setError(err.message || "Failed to fetch quote");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchQuote();

        return () => { cancelled = true; };
    }, [fromToken, toToken, debouncedAmount, slippage]);

    // Function to fetch the actual swap transaction
    const fetchSwapTransaction = async () => {
        if (!quote || !fromAddress) {
            throw new Error("Missing quote or wallet address");
        }

        setIsLoading(true);
        try {
            const txBase64 = await jupiterClient.getSwapTransaction({
                quoteResponse: quote,
                userPublicKey: fromAddress,
            });
            setSwapTx(txBase64);
            return txBase64;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { quote, swapTx, isLoading, error, fetchSwapTransaction };
}
