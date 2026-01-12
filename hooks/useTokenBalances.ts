import { useState, useEffect, useMemo, useRef } from "react";
import { createPublicClient, http, formatUnits, Address } from "viem";
import { mainnet, arbitrum, optimism, polygon, base, bsc } from "viem/chains";
import { usePrivy } from "@privy-io/react-auth";
import {
  TokenBalance,
  defaultEvmTokens,
  Chain,
  EVMChain,
} from "@/components/wallet/data";
import { 
    getTokenBalancesFromAlchemy, 
    getNativeBalanceFromAlchemy,
    getTokenMetadataFromAlchemy 
} from "@/lib/services/tokenIndexer";
import { getAlchemyRpcUrl } from "@/lib/services/alchemyClient";
import { getCachedData, setCachedData } from "@/lib/utils/cache";

// Map our internal chain IDs to Viem chains
const chainMap: Record<EVMChain, any> = {
    ethereum: mainnet,
    arbitrum: arbitrum,
    optimism: optimism,
    polygon: polygon,
    base: base,
    bsc: bsc,
};

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

// Native token addresses for each chain
const NATIVE_TOKEN_ADDRESSES: Record<EVMChain, string> = {
    ethereum: "0x0000000000000000000000000000000000000000",
    base: "0x4200000000000000000000000000000000000006",
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    optimism: "0x4200000000000000000000000000000000000006",
    polygon: "0x0000000000000000000000000000000000001010",
    bsc: "0x0000000000000000000000000000000000000000",
};

// Cache TTL: 2 minutes for balances (they can change frequently)
const BALANCE_CACHE_TTL = 2 * 60 * 1000;

export function useTokenBalances(activeChain: Chain, currentEvmChain: EVMChain) {
    const { user } = usePrivy();
    // Find the embedded wallet address
    const wallet = user?.linkedAccounts?.find((acc) => acc.type === 'wallet' && acc.walletClientType === 'privy') as any;
    const address = wallet?.address as Address | undefined;

    const [balances, setBalances] = useState<TokenBalance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Use ref to track if we're currently fetching to prevent duplicate requests
    const fetchingRef = useRef(false);
    // Use ref to track last fetch time per address+chain combo
    const lastFetchRef = useRef<{ address: string; chain: string; timestamp: number } | null>(null);

    useEffect(() => {
        async function fetchBalances() {
            if (!address || activeChain !== "EVM") {
                setBalances([]);
                return;
            }

            // Check cache first
            const cacheKey = `xylith_cache_balances_${address.toLowerCase()}_${currentEvmChain}`;
            const cached = getCachedData<TokenBalance[]>(cacheKey, BALANCE_CACHE_TTL);
            
            if (cached) {
                setBalances(cached);
                setIsLoading(false);
                // Still fetch in background to update cache, but don't show loading
                // Only if we haven't fetched recently (avoid duplicate requests)
                const lastFetch = lastFetchRef.current;
                const shouldFetch = !lastFetch || 
                    lastFetch.address !== address.toLowerCase() ||
                    lastFetch.chain !== currentEvmChain ||
                    Date.now() - lastFetch.timestamp > BALANCE_CACHE_TTL;
                
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

            try {
                // 1. Determine Chain and Client
                let targetChain: any;
                let useAlchemy = true;

                // Only use local fork if explicitly enabled via environment variable
                const useLocalFork = process.env.NEXT_PUBLIC_USE_LOCAL_FORK === 'true' && 
                                     currentEvmChain === 'ethereum' && 
                                     process.env.NODE_ENV === 'development';

                if (useLocalFork) {
                    targetChain = localFork;
                    useAlchemy = false; // Use local fork RPC for dev
                } else {
                    targetChain = chainMap[currentEvmChain];
                }

                if (!targetChain) {
                    throw new Error(`Unsupported EVM chain: ${currentEvmChain}`);
                }

                const nativeDecimals = targetChain.nativeCurrency?.decimals ?? 18;
                const nativeTokenAddress = NATIVE_TOKEN_ADDRESSES[currentEvmChain];

                // 2. Get default token list for this chain
                const defaultChainTokens = defaultEvmTokens.filter(
                    t => t.evmChain === currentEvmChain
                );

                // 3. Fetch balances using Alchemy indexer API (more efficient)
                let alchemyBalances: Map<string, string> = new Map();
                let nativeBalanceHex = "0x0";

                // Always try Alchemy via server-side API (no client-side API key check needed)
                if (useAlchemy) {
                    try {
                        // Fetch all token balances in one call
                        const tokenBalances = await getTokenBalancesFromAlchemy(address, currentEvmChain);
                        tokenBalances.forEach((token) => {
                            if (token.contractAddress) {
                                alchemyBalances.set(
                                    token.contractAddress.toLowerCase(),
                                    token.tokenBalance
                                );
                            }
                        });

                        // Fetch native balance
                        nativeBalanceHex = await getNativeBalanceFromAlchemy(address, currentEvmChain);
                    } catch (alchemyError) {
                        console.warn("Alchemy API failed, falling back to RPC:", alchemyError);
                        useAlchemy = false;
                    }
                }

                // 4. Create client for fallback or metadata fetching
                let rpcUrl: string | undefined;
                
                // Use public RPC endpoints - Alchemy calls go through API routes
                // Don't expose API keys in client-side code
                
                // Only use local fork if explicitly enabled and available
                if (!useAlchemy && useLocalFork) {
                    rpcUrl = 'http://127.0.0.1:8545';
                }

                // Use public RPC for fallback calls
                // Alchemy-specific calls already go through server-side API routes
                const client = createPublicClient({
                    chain: targetChain,
                    transport: http() // Use default public RPC
                });

                // 5. Merge default tokens with Alchemy results
                const mergedTokens: TokenBalance[] = await Promise.all(
                    defaultChainTokens.map(async (defaultToken) => {
                        const isNative = 
                            defaultToken.contractAddress === nativeTokenAddress ||
                            defaultToken.contractAddress === "0x0000000000000000000000000000000000000000";

                        let rawBalance: bigint;
                        let decimals = defaultToken.decimals ?? nativeDecimals;

                        if (isNative) {
                            // Native token balance
                            if (useAlchemy && nativeBalanceHex) {
                                rawBalance = BigInt(nativeBalanceHex);
                            } else {
                                try {
                                    rawBalance = await client.getBalance({ address });
                                } catch (e) {
                                    console.warn(`Failed to fetch native balance for ${currentEvmChain}:`, e);
                                    rawBalance = BigInt(0);
                                }
                            }
                        } else {
                            // ERC20 token balance
                            const contractAddr = defaultToken.contractAddress?.toLowerCase();
                            if (useAlchemy && contractAddr && alchemyBalances.has(contractAddr)) {
                                rawBalance = BigInt(alchemyBalances.get(contractAddr)!);
                            } else if (defaultToken.contractAddress) {
                                // Fallback to RPC call
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
                                    console.warn(`Failed to fetch balance for ${defaultToken.symbol}:`, e);
                                    rawBalance = BigInt(0);
                                }
                            } else {
                                rawBalance = BigInt(0);
                            }

                            // Fetch decimals if not in default token
                            if (!defaultToken.decimals && defaultToken.contractAddress) {
                                try {
                                    if (useAlchemy) {
                                        const metadata = await getTokenMetadataFromAlchemy(
                                            defaultToken.contractAddress as Address,
                                            currentEvmChain
                                        );
                                        if (metadata?.decimals) {
                                            decimals = metadata.decimals;
                                        }
                                    } else {
                                        const tokenDecimals = await client.readContract({
                                            address: defaultToken.contractAddress as Address,
                                            abi: [{
                                                inputs: [],
                                                name: 'decimals',
                                                outputs: [{ name: '', type: 'uint8' }],
                                                stateMutability: 'view',
                                                type: 'function'
                                            }],
                                            functionName: 'decimals'
                                        });
                                        if (typeof tokenDecimals === "number") {
                                            decimals = tokenDecimals;
                                        } else if (typeof tokenDecimals === "bigint") {
                                            decimals = Number(tokenDecimals);
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`Failed to fetch decimals for ${defaultToken.symbol}`, e);
                                }
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
                            // Update balance from fetched data
                        };
                    })
                );

                // 6. Add any new tokens found by Alchemy that aren't in default list
                if (useAlchemy) {
                    for (const [contractAddr, balanceHex] of alchemyBalances.entries()) {
                        const balance = BigInt(balanceHex);
                        if (balance === BigInt(0)) continue;

                        // Check if token already exists in merged list
                        const exists = mergedTokens.some(
                            t => t.contractAddress?.toLowerCase() === contractAddr
                        );

                        if (!exists) {
                            // Fetch metadata for new token
                            const metadata = await getTokenMetadataFromAlchemy(
                                contractAddr as Address,
                                currentEvmChain
                            );

                            if (metadata) {
                                const decimals = metadata.decimals ?? 18;
                                const amount = parseFloat(formatUnits(balance, decimals));
                                
                                mergedTokens.push({
                                    symbol: metadata.symbol || "UNKNOWN",
                                    name: metadata.name || "Unknown Token",
                                    chain: "EVM",
                                    evmChain: currentEvmChain,
                                    amount,
                                    usdValue: 0, // Price will be fetched separately if needed
                                    contractAddress: contractAddr,
                                    decimals,
                                    logo: metadata.logo,
                                });
                            }
                        }
                    }
                }

                // 7. Sort tokens: non-zero by USD value (desc), zero balances at end
                const sortedTokens = [
                    ...mergedTokens
                        .filter(t => t.usdValue > 0)
                        .sort((a, b) => b.usdValue - a.usdValue),
                    ...mergedTokens.filter(t => t.usdValue === 0)
                ];

                setBalances(sortedTokens);
                
                // Cache the result
                setCachedData(cacheKey, sortedTokens);
                lastFetchRef.current = {
                    address: address.toLowerCase(),
                    chain: currentEvmChain,
                    timestamp: Date.now(),
                };

            } catch (err) {
                console.error("Error in useTokenBalances:", err);
                setError("Failed to load balances");
                // On error, try to use cached data if available
                const cached = getCachedData<TokenBalance[]>(cacheKey, BALANCE_CACHE_TTL * 2); // Use stale cache on error
                if (cached) {
                    setBalances(cached);
                }
            } finally {
                setIsLoading(false);
                fetchingRef.current = false;
            }
        }

        fetchBalances();
    }, [address, activeChain, currentEvmChain]); // Removed 'user' from dependencies - only depend on address

    return { balances, isLoading, error };
}
