import { useEffect, useState } from "react";
import { TokenBalance } from "@/components/wallet/data";

export interface SolanaShieldWarning {
    type: string;
    message: string;
    severity: "info" | "warning" | "error" | string;
}

interface UseSolanaShieldResult {
    warnings: Record<string, SolanaShieldWarning[]>;
    isLoading: boolean;
    error: string | null;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache
const shieldCache: Record<string, { timestamp: number; warnings: SolanaShieldWarning[] }> = {};

export function useSolanaShield(tokens: TokenBalance[], enabled: boolean): UseSolanaShieldResult {
    const [warnings, setWarnings] = useState<Record<string, SolanaShieldWarning[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Create a stable key for dependencies to avoid re-running on every render if array ref changes but content is same
    const stableKey = tokens
        .map(t => t.contractAddress)
        .sort()
        .join(',');

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const mints = Array.from(
            new Set(
                tokens
                    .map((t) => t.contractAddress)
                    .filter((m): m is string => !!m),
            ),
        );

        if (mints.length === 0) {
            setWarnings({});
            return;
        }

        const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const validMints = mints.filter((m) => SOLANA_ADDRESS_REGEX.test(m)).slice(0, 50);

        if (validMints.length === 0) {
            setWarnings({});
            return;
        }

        // Check Cache first
        const now = Date.now();
        const neededMints: string[] = [];
        const nextWarnings: Record<string, SolanaShieldWarning[]> = {};

        // Populate from cache
        validMints.forEach(mint => {
            if (shieldCache[mint] && (now - shieldCache[mint].timestamp < CACHE_TTL)) {
                if (shieldCache[mint].warnings.length > 0) {
                    nextWarnings[mint] = shieldCache[mint].warnings;
                }
            } else {
                neededMints.push(mint);
            }
        });

        // Set initial (cached) warnings immediately
        setWarnings(prev => {
            // Only update if actually different to prevent render loops
            const isDifferent = JSON.stringify(prev) !== JSON.stringify(nextWarnings);
            return isDifferent ? nextWarnings : prev;
        });

        if (neededMints.length === 0) {
            // All cached
            return;
        }

        // Fetch missing
        setIsLoading(true);
        setError(null);

        fetch(`/api/ultra/shield?mints=${encodeURIComponent(neededMints.join(","))}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch shield warnings: ${res.statusText}`);
                }
                return res.json();
            })
            .then((data) => {
                const newWarnings = data.warnings || {};

                // Update Cache
                Object.keys(newWarnings).forEach(mint => {
                    shieldCache[mint] = {
                        timestamp: Date.now(),
                        warnings: newWarnings[mint]
                    };
                });

                // Also cache "safe" tokens (no warnings) to avoid refetching them
                neededMints.forEach(mint => {
                    if (!newWarnings[mint]) {
                        shieldCache[mint] = {
                            timestamp: Date.now(),
                            warnings: []
                        };
                    }
                });

                // Merge with existing
                setWarnings((prev) => ({
                    ...prev,
                    ...newWarnings
                }));
            })
            .catch((err) => {
                console.error("Error fetching Solana shield warnings:", err);
                setError(err.message || "Failed to load shield warnings");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [enabled, stableKey]); // Depend on stableKey, not tokens array

    return { warnings, isLoading, error };
}

