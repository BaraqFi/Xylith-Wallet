import { useState, useEffect } from "react";
import { OneInchClient, OneInchQuoteParams, OneInchSwapParams } from "@/lib/1inch/client";
import { Quote, SwapResponse } from "@/lib/1inch/types";
// Local debounce used below

// Simple debounce hook if not exists
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

export function useSwapQuote({
    fromToken,
    toToken,
    amount,
    chainId,
    slippage,
    address,
}: {
    fromToken: any;
    toToken: any;
    amount: string;
    chainId: number;
    slippage: number;
    address?: string;
}) {
    const [quote, setQuote] = useState<Quote | null>(null);
    const [swapTx, setSwapTx] = useState<SwapResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debouncedAmount = useLocalDebounce(amount, 500);

    useEffect(() => {
        async function fetchQuote() {
            if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !chainId) {
                setQuote(null);
                return;
            }

            // Check for same chain
            // This logic should be in UI, but safety here too
            if (fromToken.address === toToken.address) return;

            setIsLoading(true);
            setError(null);

            try {
                // We use GetQuote for the UI update (faster, less parameters needed)
                const params: OneInchQuoteParams = {
                    src: fromToken.contractAddress || fromToken.address, // Handle both data shapes
                    dst: toToken.contractAddress || toToken.address,
                    amount: (parseFloat(debouncedAmount) * Math.pow(10, fromToken.decimals)).toFixed(0), // Convert to Wei
                    chainId: chainId,
                };

                const quoteData = await OneInchClient.getQuote(params);
                setQuote(quoteData);

                // If we have an address, we can also pre-fetch the Swap Calldata (optional, but good for "Review" step readiness)
                // But strictly for "Preview", Quote is enough. 
                // We will fetch Swap only when requested (e.g. prepared for step 2) to save API calls, 
                // OR fetch it here if we want immediate readiness.
                // Let's reset swapTx here, and let a separate trigger fetch the actual swap data?
                // Actually, typical flow: 
                // 1. User Types -> Get Quote (Price)
                // 2. User Clicks "Review" -> Get Swap (Transaction)
                setSwapTx(null);

            } catch (err: any) {
                console.error("Quote fetch error:", err);
                setError(err.message || "Failed to fetch quote");
                setQuote(null);
            } finally {
                setIsLoading(false);
            }
        }

        fetchQuote();
    }, [fromToken, toToken, debouncedAmount, chainId]);

    // Function to explicitly fetch the full swap transaction (calldata)
    const fetchSwapTransaction = async () => {
        if (!fromToken || !toToken || !amount || !chainId || !address) {
            throw new Error("Missing parameters for swap");
        }

        setIsLoading(true);
        try {
            const params: OneInchSwapParams = {
                src: fromToken.contractAddress || fromToken.address,
                dst: toToken.contractAddress || toToken.address,
                amount: (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toFixed(0),
                chainId: chainId,
                from: address,
                slippage: slippage,
                disableEstimate: process.env.NODE_ENV === 'development', // Critical for local fork
            };

            const swapData = await OneInchClient.getSwap(params);
            setSwapTx(swapData);
            return swapData;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { quote, swapTx, isLoading, error, fetchSwapTransaction };
}
