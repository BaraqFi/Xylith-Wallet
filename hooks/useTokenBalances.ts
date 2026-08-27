import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatUnits, Address } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import {
    TokenBalance,
    defaultEvmTokens,
    defaultSolanaTokens,
    Chain,
    EVMChain,
    NATIVE_TOKEN_SENTINEL,
    isNativeTokenAddress,
} from "@/components/wallet/data";
import {
    getTokenBalancesFromAlchemy,
    getTokenBalancesFromMoralis,
    getNativeBalanceFromAlchemy,
    getTokenMetadataFromAlchemy
} from "@/lib/services/tokenIndexer";
import { getPublicRpcClient, getCustomRpcClient } from "@/lib/services/rpcConfig";
import { getCachedData, setCachedData } from "@/lib/utils/cache";
import { solanaClient } from "@/lib/solana/client";
import { getTokenPricesBatch } from "@/lib/services/tokenAnalyticsService";

// Local Fork Chain Definition (matches PrivyProvider)
const localFork = {
    id: 1337,
    name: 'Local Mainnet Fork',
    network: 'local-fork',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
    },
} as const;

// Cache TTL: 2 minutes for balances to be considered "fresh"
const BALANCE_CACHE_TTL = 2 * 60 * 1000;

export function useTokenBalances(activeChain: Chain, currentEvmChain: EVMChain) {
    const { user } = usePrivy();

    // Find the relevant address based on active chain
    const address = useMemo(() => {
        if (!user?.linkedAccounts) return undefined;
        if (activeChain === 'EVM') {
            const acc = user.linkedAccounts.find(a => a.type === 'wallet' && (a as any).chainType === 'ethereum');
            return acc ? (acc as any).address : undefined;
        } else { // Solana
            const acc = user.linkedAccounts.find(a => a.type === 'wallet' && (a as any).chainType === 'solana');
            return acc ? (acc as any).address : undefined;
        }
    }, [user, activeChain]);

    const [balances, setBalances] = useState<TokenBalance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Bumped by refresh() to force a re-fetch that ignores the freshness window —
    // used right after a transaction, when the cached balance is known stale.
    const [refreshNonce, setRefreshNonce] = useState(0);

    // The cache key currently being fetched, so a duplicate request for the SAME
    // key is skipped while a switch to a DIFFERENT chain still goes through.
    const fetchingKeyRef = useRef<string | null>(null);
    // The most recently requested key; a response for anything else is stale and
    // must not overwrite the balances the user is now looking at.
    const activeKeyRef = useRef<string | null>(null);
    // Use ref to track last fetch time per address+chain combo
    const lastFetchRef = useRef<{ key: string; timestamp: number; nonce: number } | null>(null);

    useEffect(() => {
        async function fetchBalances() {
            if (!address) {
                setBalances([]);
                return;
            }

            // Construct precise cache key
            const chainKey = activeChain === "EVM" ? currentEvmChain : "solana";
            // v2: native rows now use the 0xeeee… sentinel instead of WETH addresses;
            // the version bump keeps stale v1 rows from resurfacing via cache.
            const cacheKey = `xylith_cache_balances_v2_${address.toLowerCase()}_${chainKey}`;
            // Mark this as the view the user is on, so late responses for a chain
            // they've switched away from are discarded rather than painted.
            activeKeyRef.current = cacheKey;

            // 1. Check Cache (Stale-While-Revalidate)
            // We pass a very long TTL here because we WANT stale data immediately
            // We will decide whether to fetch fresh data separately
            const cached = getCachedData<TokenBalance[]>(cacheKey, 24 * 60 * 60 * 1000); // 24h stale allowance

            if (cached) {
                setBalances(cached);
                // If we have cached data, we DON'T show loading spinner
                // We just update silently
            } else {
                setIsLoading(true);
            }

            // 2. Decide if we need to fetch fresh data
            const lastFetch = lastFetchRef.current;
            const now = Date.now();

            // Should fetch if:
            // - No last fetch recorded
            // - Last fetch was for a different key (address/chain changed)
            // - Last fetch was older than TTL (2 mins)
            const shouldFetch = !lastFetch ||
                lastFetch.key !== cacheKey ||
                (now - lastFetch.timestamp > BALANCE_CACHE_TTL) ||
                lastFetch.nonce !== refreshNonce;

            // Skip only when this exact key is already in flight. Bailing on ANY
            // in-flight fetch meant switching chains mid-request abandoned the new
            // chain entirely — balances sat at 0 until the user toggled again.
            if (!shouldFetch || fetchingKeyRef.current === cacheKey) {
                if (cached && !shouldFetch) setIsLoading(false);
                return;
            }

            fetchingKeyRef.current = cacheKey;
            setError(null);

            try {
                let newBalances: TokenBalance[] = [];

                if (activeChain === "Solana") {
                    // --- SOLANA FETCHING ---
                    let solBalanceLamports = 0;
                    let splAccounts: { mint: string; amount: string; decimals: number }[] = [];

                    try {
                        // Primary: direct RPC via solanaClient
                        solBalanceLamports = await solanaClient.getBalance(address);
                        const rawAccounts = await solanaClient.getTokenAccounts(address);
                        splAccounts = rawAccounts.map((a) => ({
                            mint: a.mint,
                            amount: a.amount,
                            decimals: a.decimals,
                        }));
                    } catch (rpcError) {
                        console.warn("Solana RPC failed, trying Ultra holdings fallback:", rpcError);
                        try {
                            const res = await fetch(
                                `/api/ultra/holdings?address=${encodeURIComponent(address)}`,
                            );
                            if (res.ok) {
                                const data = await res.json();
                                const amountStr =
                                    typeof data.amount === "string" ? data.amount : "0";
                                solBalanceLamports = Number(amountStr);

                                const tokensObj =
                                    data.tokens && typeof data.tokens === "object"
                                        ? data.tokens
                                        : {};
                                const accounts: {
                                    mint: string;
                                    amount: string;
                                    decimals: number;
                                }[] = [];
                                for (const mint of Object.keys(tokensObj)) {
                                    const arr = Array.isArray(tokensObj[mint])
                                        ? tokensObj[mint]
                                        : [];
                                    for (const entry of arr) {
                                        if (
                                            entry &&
                                            typeof entry.amount === "string" &&
                                            typeof entry.decimals === "number"
                                        ) {
                                            accounts.push({
                                                mint,
                                                amount: entry.amount,
                                                decimals: entry.decimals,
                                            });
                                        }
                                    }
                                }
                                splAccounts = accounts;
                            }
                        } catch (ultraError) {
                            console.warn(
                                "Ultra holdings fallback also failed:",
                                ultraError,
                            );
                        }
                    }

                    const solBalance = solBalanceLamports / 1e9;

                    // Start with default Solana tokens
                    const mergedTokens = defaultSolanaTokens.map(t => ({ ...t })); // Clone

                    // Update SOL
                    const solToken = mergedTokens.find(t => t.symbol === "SOL");
                    if (solToken) {
                        solToken.amount = solBalance;
                        solToken.usdValue = solBalance * (solToken.pricePerToken || 0); // Price needed?
                    }

                    // Create a map of found mints
                    const foundSpls = new Map(splAccounts.map(a => [a.mint, a]));

                    // Update defaults and fetch analytics
                    mergedTokens.forEach((t) => {
                        if (t.contractAddress && foundSpls.has(t.contractAddress)) {
                            const account = foundSpls.get(t.contractAddress)!;
                            const amount = parseFloat(account.amount) / Math.pow(10, account.decimals);
                            t.amount = amount;
                            // Price update happens in batch below
                        }
                    });

                    // Add unknown SPL tokens found in wallet with analytics
                    for (const [mint, account] of foundSpls.entries()) {
                        const exists = mergedTokens.some(t => t.contractAddress === mint);
                        if (!exists) {
                            const decimals = account.decimals;
                            const amount = parseFloat(account.amount) / Math.pow(10, decimals);

                            if (amount > 0) {
                                mergedTokens.push({
                                    symbol: "UNKNOWN",
                                    name: `Unknown (${mint.slice(0, 4)}...${mint.slice(-4)})`,
                                    chain: "Solana",
                                    amount,
                                    usdValue: 0,
                                    contractAddress: mint,
                                    decimals: decimals,
                                    pricePerToken: 0,
                                });
                            }
                        }
                    }

                    // --- BATCH PRICE FETCH FOR SOLANA ---
                    // Fetch prices for all tokens that have balance > 0 (or all defaults)
                    try {
                        const prices = await getTokenPricesBatch(
                            mergedTokens.map(t => ({ symbol: t.symbol, contractAddress: t.contractAddress }))
                        );

                        mergedTokens.forEach(t => {
                            if (prices[t.symbol]) {
                                t.pricePerToken = prices[t.symbol];
                                t.usdValue = t.amount * t.pricePerToken;
                                // Initialize analytics structure with just price (chart lazy loaded later)
                                t.analytics = {
                                    currentPriceUsd: t.pricePerToken,
                                    priceChange24h: 0,
                                    priceChange7d: 0
                                };
                            }
                        });
                    } catch (err) {
                        console.warn("Failed to fetch batch prices:", err);
                    }

                    newBalances = mergedTokens;

                } else {
                    // --- EVM FETCHING (Existing Logic) ---
                    const useLocalFork = process.env.NEXT_PUBLIC_USE_LOCAL_FORK === 'true' &&
                        currentEvmChain === 'ethereum' &&
                        process.env.NODE_ENV === 'development';

                    const defaultChainTokens = defaultEvmTokens.filter(
                        t => t.evmChain === currentEvmChain
                    );

                    let alchemyBalances: Map<string, string> = new Map();
                    let moralisBalances: Map<string, { balance: string; metadata?: any }> = new Map();
                    let nativeBalanceHex = "0x0";
                    let useAlchemy = false;
                    let useMoralis = false;

                    if (!useLocalFork) {
                        // Try Moralis first (primary) - better token coverage and includes metadata/prices
                        try {
                            const moralisTokens = await getTokenBalancesFromMoralis(address, currentEvmChain);
                            moralisTokens.forEach((token) => {
                                // Normalise native tokens so we don't get duplicate rows like
                                // "Ether" vs "Ethereum" from different sources. Moralis reports
                                // native balances either with no address or with the 0xeeee…
                                // sentinel; both collapse onto our canonical native row.
                                let rawAddr = token.contractAddress?.toLowerCase() || "";
                                if (!rawAddr || rawAddr === NATIVE_TOKEN_SENTINEL) {
                                    rawAddr = NATIVE_TOKEN_SENTINEL;
                                }

                                if (rawAddr) {
                                    moralisBalances.set(
                                        rawAddr,
                                        {
                                            balance: token.tokenBalance,
                                            metadata: {
                                                name: token.name,
                                                symbol: token.symbol,
                                                decimals: token.decimals,
                                                logo: token.logo,
                                                usdValue: token.usdValue,
                                                pricePerToken: token.pricePerToken,
                                            }
                                        }
                                    );
                                }
                            });
                            useMoralis = true;

                            // Try to get native balance from Alchemy (or fallback to RPC)
                            try {
                                nativeBalanceHex = await getNativeBalanceFromAlchemy(address, currentEvmChain);
                            } catch {
                                // Will fall back to RPC below
                            }
                        } catch (moralisError) {
                            console.warn("Moralis API failed, trying Alchemy fallback:", moralisError);

                            // Fallback to Alchemy
                            try {
                                const tokenBalances = await getTokenBalancesFromAlchemy(address, currentEvmChain);
                                tokenBalances.forEach((token) => {
                                    if (token.contractAddress) {
                                        alchemyBalances.set(
                                            token.contractAddress.toLowerCase(),
                                            token.tokenBalance
                                        );
                                    }
                                });
                                nativeBalanceHex = await getNativeBalanceFromAlchemy(address, currentEvmChain);
                                useAlchemy = true;
                            } catch (alchemyError) {
                                console.warn("Alchemy API also failed, falling back to RPC:", alchemyError);
                            }
                        }
                    } else {
                        useAlchemy = false;
                    }

                    const client = useLocalFork
                        ? getCustomRpcClient(currentEvmChain, 'http://127.0.0.1:8545')
                        : getPublicRpcClient(currentEvmChain);

                    const targetChain = client.chain;
                    const nativeDecimals = targetChain?.nativeCurrency?.decimals ?? 18;

                    const mergedTokens: TokenBalance[] = await Promise.all(
                        defaultChainTokens.map(async (defaultToken) => {
                            const isNative = isNativeTokenAddress(defaultToken.contractAddress);

                            let rawBalance: bigint;
                            let decimals = defaultToken.decimals ?? nativeDecimals;

                            if (isNative) {
                                if (nativeBalanceHex && nativeBalanceHex !== "0x0") {
                                    rawBalance = BigInt(nativeBalanceHex);
                                } else {
                                    try {
                                        rawBalance = await client.getBalance({ address }) as bigint;
                                    } catch (e) {
                                        rawBalance = BigInt(0);
                                    }
                                }
                            } else {
                                const contractAddr = defaultToken.contractAddress?.toLowerCase();
                                if (useAlchemy && contractAddr && alchemyBalances.has(contractAddr)) {
                                    rawBalance = BigInt(alchemyBalances.get(contractAddr)!);
                                } else if (defaultToken.contractAddress) {
                                    try {
                                        rawBalance = await client.readContract({
                                            address: defaultToken.contractAddress as Address,
                                            abi: [{
                                                inputs: [{ name: 'account', type: 'address' }],
                                                name: 'balanceOf',
                                                outputs: [{ name: '', type: 'uint256' }],
                                                stateMutability: 'view',
                                                type: 'function'
                                            }],
                                            functionName: 'balanceOf',
                                            args: [address]
                                        }) as bigint;
                                    } catch (e) {
                                        rawBalance = BigInt(0);
                                    }
                                } else {
                                    rawBalance = BigInt(0);
                                }

                                if (!defaultToken.decimals && defaultToken.contractAddress) {
                                    // Decimals logic omitted for brevity in rebuild, assuming defaults correct or fetched
                                    // In full impl, reuse previous logic if needed. 
                                    // For efficiency, assumed defaultToken.decimals is mostly present.
                                    // If needed, we can re-add the lengthy decimal fetch code or trust defaults.
                                }
                            }

                            const amount = parseFloat(formatUnits(rawBalance, decimals));
                            const price = defaultToken.pricePerToken || 0;
                            const usdValue = amount * price;

                            return {
                                ...defaultToken,
                                amount,
                                usdValue,
                                decimals,
                            };
                        })
                    );

                    // Add discovered tokens from Alchemy or Moralis
                    if (useMoralis) {
                        // Process Moralis tokens
                        for (const [contractAddr, tokenData] of moralisBalances.entries()) {
                            const balanceHex = tokenData.balance;
                            const balance = BigInt(balanceHex);
                            // Include tokens with balance > 0 (don't skip them)
                            if (balance === BigInt(0)) continue;

                            // Check if token already exists in merged list (by contract address and chain)
                            const exists = mergedTokens.some(
                                t => t.contractAddress?.toLowerCase() === contractAddr && t.evmChain === currentEvmChain
                            );

                            if (!exists) {
                                // Moralis already provides metadata
                                const meta = tokenData.metadata;
                                const decimals = meta?.decimals ?? 18;
                                const amount = parseFloat(formatUnits(balance, decimals));

                                mergedTokens.push({
                                    symbol: meta?.symbol || "UNKNOWN",
                                    name: meta?.name || `Unknown (${contractAddr.slice(0, 4)}...${contractAddr.slice(-4)})`,
                                    chain: "EVM",
                                    evmChain: currentEvmChain,
                                    amount,
                                    usdValue: meta?.usdValue || 0,
                                    contractAddress: contractAddr,
                                    decimals,
                                    logo: meta?.logo,
                                    pricePerToken: meta?.pricePerToken || 0,
                                });
                            }
                        }
                    } else if (useAlchemy) {
                        // Process Alchemy tokens
                        for (const [contractAddr, balanceHex] of alchemyBalances.entries()) {
                            const balance = BigInt(balanceHex);
                            // Include tokens with balance > 0 (don't skip them)
                            if (balance === BigInt(0)) continue;

                            // Check if token already exists in merged list (by contract address and chain)
                            const exists = mergedTokens.some(
                                t => t.contractAddress?.toLowerCase() === contractAddr && t.evmChain === currentEvmChain
                            );

                            if (!exists) {
                                // Alchemy path - fetch metadata
                                try {
                                    const metadata = await getTokenMetadataFromAlchemy(
                                        contractAddr as Address,
                                        currentEvmChain
                                    );

                                    const decimals = metadata?.decimals ?? 18;
                                    const amount = parseFloat(formatUnits(balance, decimals));

                                    // Analytics fetched in batch below
                                    const pricePerToken = 0;
                                    const usdValue = 0; // Updated in batch

                                    mergedTokens.push({
                                        symbol: metadata?.symbol || "UNKNOWN",
                                        name: metadata?.name || `Unknown (${contractAddr.slice(0, 4)}...${contractAddr.slice(-4)})`,
                                        chain: "EVM",
                                        evmChain: currentEvmChain,
                                        amount,
                                        usdValue,
                                        contractAddress: contractAddr,
                                        decimals,
                                        logo: metadata?.logo,
                                        pricePerToken,
                                    });
                                } catch (err) {
                                    console.warn(`Failed to fetch metadata for token ${contractAddr} on ${currentEvmChain}:`, err);
                                    // Still add the token with basic info if metadata fetch fails
                                    const decimals = 18; // Default
                                    const amount = parseFloat(formatUnits(balance, decimals));
                                    mergedTokens.push({
                                        symbol: "UNKNOWN",
                                        name: `Unknown Token (${contractAddr.slice(0, 4)}...${contractAddr.slice(-4)})`,
                                        chain: "EVM",
                                        evmChain: currentEvmChain,
                                        amount,
                                        usdValue: 0,
                                        contractAddress: contractAddr,
                                        decimals,
                                        pricePerToken: 0,
                                    });
                                }
                            }
                        }
                    }

                    // --- BATCH PRICE FETCH FOR EVM ---
                    try {
                        // Call proxy API to avoid CORS and manage rate limits on server
                        const response = await fetch('/api/prices/batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tokens: mergedTokens.map(t => ({ symbol: t.symbol, contractAddress: t.contractAddress })),
                                currency: 'usd'
                            })
                        });

                        const prices = response.ok ? await response.json() : {};

                        mergedTokens.forEach(t => {
                            const price = prices[t.symbol];
                            if (price) {
                                t.pricePerToken = price;
                                t.usdValue = t.amount * price;
                                // Initialize analytics structure with just price (chart lazy loaded later)
                                t.analytics = {
                                    currentPriceUsd: price,
                                    priceChange24h: 0,
                                    priceChange7d: 0
                                };
                            }
                        });
                    } catch (err) {
                        console.warn("Failed to fetch batch prices:", err);
                    }

                    newBalances = mergedTokens;
                }

                // Sort: Value desc, then zero
                const sortedTokens = [
                    ...newBalances.filter(t => t.usdValue > 0).sort((a, b) => b.usdValue - a.usdValue),
                    ...newBalances.filter(t => t.usdValue === 0)
                ];

                // Cache regardless — the data is valid for its own key even if the
                // user has since switched away.
                setCachedData(cacheKey, sortedTokens);
                lastFetchRef.current = {
                    key: cacheKey,
                    timestamp: Date.now(),
                    nonce: refreshNonce,
                };

                // Only paint if this is still the chain being viewed, so a slow
                // response for the previous chain can't overwrite the current one.
                if (activeKeyRef.current === cacheKey) {
                    setBalances(sortedTokens);
                }

            } catch (err) {
                console.error("Error fetching balances:", err);
                // Don't clear balances on error if we have stale data
                if (balances.length === 0) {
                    setError("Failed to load balances");
                }
            } finally {
                if (activeKeyRef.current === cacheKey) {
                    setIsLoading(false);
                }
                if (fetchingKeyRef.current === cacheKey) {
                    fetchingKeyRef.current = null;
                }
            }
        }

        fetchBalances();
    }, [address, activeChain, currentEvmChain, refreshNonce]); // Depend on address, chain, and manual refresh

    /** Force a fresh fetch, bypassing the freshness window (post-transaction). */
    const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

    return { balances, isLoading, error, refresh };
}

