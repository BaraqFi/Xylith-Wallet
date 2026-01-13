import { EVMChain } from "@/components/wallet/data";

/**
 * Server-side RPC Service
 * Handles provider rotation and URL construction for Ankr, Infura, Alchemy, and fallback publics.
 */

// Supported RPC Providers
type RpcProvider = 'ankr' | 'infura' | 'alchemy' | 'public_llama' | 'public_official';

interface RpcEndpoint {
    provider: RpcProvider;
    url: string;
}

// Map internal chain names to provider-specific slugs
const CHAIN_SLUGS: Record<EVMChain, { ankr: string; infura: string; alchemy: string; llama: string }> = {
    ethereum: { ankr: 'eth', infura: 'mainnet', alchemy: 'eth-mainnet', llama: 'eth' },
    base: { ankr: 'base', infura: 'base-mainnet', alchemy: 'base-mainnet', llama: 'base' },
    arbitrum: { ankr: 'arbitrum', infura: 'arbitrum-mainnet', alchemy: 'arb-mainnet', llama: 'arbitrum' },
    optimism: { ankr: 'optimism', infura: 'optimism-mainnet', alchemy: 'opt-mainnet', llama: 'optimism' },
    polygon: { ankr: 'polygon', infura: 'polygon-mainnet', alchemy: 'polygon-mainnet', llama: 'polygon' },
    bsc: { ankr: 'bsc', infura: '', alchemy: 'bsc-mainnet', llama: 'bsc' }, // Infura doesn't support BSC standardly
};

// Official public nodes as last resort
const PUBLIC_OFFICIAL: Record<EVMChain, string> = {
    ethereum: 'https://sys.merkle.io/eth-mainnet', // Reliable public node
    base: 'https://mainnet.base.org',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    polygon: 'https://polygon-rpc.com',
    bsc: 'https://bsc-dataseed.binance.org',
};

// Global rotation index (simple round-robin per chain)
const rotationIndex: Record<string, number> = {};

/**
 * Build list of available RPC endpoints for a chain, based on available API keys.
 * Priorities: Ankr -> Infura -> Alchemy -> Public
 */
function getAvailableEndpoints(chain: EVMChain): RpcEndpoint[] {
    const endpoints: RpcEndpoint[] = [];
    const slugs = CHAIN_SLUGS[chain];

    // 1. Ankr (Premium / Standard)
    if (process.env.ANKR_API_KEY) {
        endpoints.push({
            provider: 'ankr',
            url: `https://rpc.ankr.com/${slugs.ankr}/${process.env.ANKR_API_KEY}`
        });
    }

    // 2. Infura
    if (process.env.INFURA_API_KEY && slugs.infura) {
        endpoints.push({
            provider: 'infura',
            url: `https://${slugs.infura}.infura.io/v3/${process.env.INFURA_API_KEY}`
        });
    }

    // 3. Alchemy
    if (process.env.ALCHEMY_API_KEY) {
        endpoints.push({
            provider: 'alchemy',
            url: `https://${slugs.alchemy}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        });
    }

    // 4. Llama (Public - Reliable)
    endpoints.push({
        provider: 'public_llama',
        url: `https://${slugs.llama}.llamarpc.com`
    });

    // 5. Official Public (Last Resort)
    endpoints.push({
        provider: 'public_official',
        url: PUBLIC_OFFICIAL[chain]
    });

    return endpoints;
}

/**
 * Get the next RPC URL for a chain using rotation logic.
 */
export function getRotatedRpcUrl(chain: EVMChain): string {
    const endpoints = getAvailableEndpoints(chain);
    if (endpoints.length === 0) {
        throw new Error(`No RPC endpoints available for ${chain}`);
    }

    // Initialize index if needed
    if (rotationIndex[chain] === undefined) {
        rotationIndex[chain] = 0;
    }

    // Get current endpoint
    const current = endpoints[rotationIndex[chain] % endpoints.length];

    // Rotate for next time
    rotationIndex[chain] = (rotationIndex[chain] + 1) % endpoints.length;

    // console.log(`[RPC Rotation] Using ${current.provider} for ${chain}`);
    return current.url;
}

/**
 * Execute an RPC request through the rotated proxy.
 * Handles fetch logic and basic error wrapping.
 */
export async function executeRpcRequest(chain: EVMChain, method: string, params: any[]) {
    const url = getRotatedRpcUrl(chain);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method,
            params,
        }),
        // Add a reasonable timeout? Next.js fetch defaults are usually okay, but for RPC we might want faster failover in future.
    });

    if (!response.ok) {
        throw new Error(`RPC Provider refused connection: ${response.statusText}`);
    }

    const data = await response.json();

    // Forward upstream errors if present
    if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
}
