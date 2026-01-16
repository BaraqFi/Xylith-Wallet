import { useState, useEffect } from 'react';
import { TokenBalance } from '@/components/wallet/data';

const JUPITER_STRICT_LIST_URL = '/api/jupiter/tokens';
const CACHE_KEY = 'xylith_solana_token_list';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface JupiterToken {
    address?: string; // Old API format
    id?: string; // New API v2 format (mint address)
    chainId?: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string; // Old API format
    icon?: string; // New API v2 format
    tags?: string[];
}

export function useSolanaTokenList() {
    const [tokens, setTokens] = useState<TokenBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTokens() {
            try {
                // Check cache
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setTokens(data);
                        setIsLoading(false);
                        return;
                    }
                }

                const response = await fetch(JUPITER_STRICT_LIST_URL);
                if (!response.ok) {
                    throw new Error('Failed to fetch Solana token list');
                }

                const jupiterTokens: JupiterToken[] = await response.json();

                // Map to TokenBalance format
                // Note: amount and price will be 0/undefined here as this is just the reference list
                // Handle both old API format (address) and new API v2 format (id)
                const mappedTokens: TokenBalance[] = jupiterTokens
                    .filter((t) => t.address || t.id) // Only include tokens with valid address/id
                    .map((t) => ({
                        name: t.name,
                        symbol: t.symbol,
                        decimals: t.decimals,
                        amount: 0,
                        chain: 'Solana',
                        contractAddress: t.address || t.id || '', // Support both formats
                        usdValue: 0,
                    }));

                setTokens(mappedTokens);

                // Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: mappedTokens,
                    timestamp: Date.now()
                }));

            } catch (err: any) {
                console.error('Error fetching Solana token list:', err);
                setError(err.message || 'Failed to load token list');
                // Fallback to empty or maybe a robust default list?
            } finally {
                setIsLoading(false);
            }
        }

        fetchTokens();
    }, []);

    return { tokens, isLoading, error };
}
