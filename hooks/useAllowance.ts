import { useState, useEffect } from "react";
import { createPublicClient, http, parseAbiItem, Address } from "viem";
import { mainnet, arbitrum, optimism, polygon, base, bsc } from "viem/chains";
import { usePrivy } from "@privy-io/react-auth";
import { EVMChain } from "@/components/wallet/data";

const chainMap: Record<EVMChain, any> = {
    ethereum: mainnet,
    arbitrum: arbitrum,
    optimism: optimism,
    polygon: polygon,
    base: base,
    bsc: bsc,
};

const localFork = {
    id: 1337,
    name: 'Local Mainnet Fork',
    network: 'local-fork',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
    },
} as const;

export function useAllowance(
    tokenAddress: string | undefined,
    spenderAddress: string | undefined,
    userAddress: string | undefined,
    amount: string,
    evmChain: EVMChain | undefined
) {
    const [allowance, setAllowance] = useState<bigint>(BigInt(0));
    const [isLoading, setIsLoading] = useState(false);
    const [refetchIndex, setRefetchIndex] = useState(0);

    const refetch = () => setRefetchIndex(prev => prev + 1);

    useEffect(() => {
        async function fetchAllowance() {
            if (!tokenAddress || !spenderAddress || !userAddress || !evmChain) {
                setAllowance(BigInt(0));
                return;
            }

            // Native tokens (ETH) don't need allowance
            if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                setAllowance(BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")); // Max Uint256
                return;
            }

            setIsLoading(true);
            try {
                let client;
                if (evmChain === 'ethereum' && process.env.NODE_ENV === 'development') {
                    client = createPublicClient({ chain: localFork, transport: http() });
                } else {
                    client = createPublicClient({ chain: chainMap[evmChain], transport: http() });
                }

                const res = await client.readContract({
                    address: tokenAddress as Address,
                    abi: [parseAbiItem('function allowance(address owner, address spender) view returns (uint256)')],
                    functionName: 'allowance',
                    args: [userAddress as Address, spenderAddress as Address]
                });

                setAllowance(res as bigint);
            } catch (err) {
                console.error("Allowance check failed:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchAllowance();
    }, [tokenAddress, spenderAddress, userAddress, evmChain, refetchIndex]);

    // Check if approval is needed based on specific amount
    // amount is input string "100.5", need to compare with allowance (bigint) using decimals?
    // Caller should handle decimal logic? Or pass decimals here?
    // Let's return raw allowance.
    return { allowance, isLoading, refetch };
}
