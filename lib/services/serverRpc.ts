import { EVMChain } from "@/components/wallet/data";

/**
 * Server-side RPC Service
 * Handles provider rotation and URL construction for Ankr, Infura, Alchemy, and fallback publics.
 */

// Supported RPC Providers
type RpcProvider =
    | "ankr"
    | "infura"
    | "alchemy"
    | "public_llama"
    | "public_official"
    | "helius";

interface RpcEndpoint {
    provider: RpcProvider;
    url: string;
}

export type SupportedRpcChain = EVMChain | "solana";

// Map internal chain names to provider-specific slugs
const CHAIN_SLUGS: Record<
    SupportedRpcChain,
    { ankr: string; infura: string; alchemy: string; llama: string }
> = {
    ethereum: { ankr: "eth", infura: "mainnet", alchemy: "eth-mainnet", llama: "eth" },
    base: { ankr: "base", infura: "base-mainnet", alchemy: "base-mainnet", llama: "base" },
    arbitrum: {
        ankr: "arbitrum",
        infura: "arbitrum-mainnet",
        alchemy: "arb-mainnet",
        llama: "arbitrum",
    },
    optimism: {
        ankr: "optimism",
        infura: "optimism-mainnet",
        alchemy: "opt-mainnet",
        llama: "optimism",
    },
    polygon: {
        ankr: "polygon",
        infura: "polygon-mainnet",
        alchemy: "polygon-mainnet",
        llama: "polygon",
    },
    bsc: { ankr: "bsc", infura: "", alchemy: "bsc-mainnet", llama: "bsc" },
    solana: {
        ankr: "solana",
        infura: "",
        alchemy: "solana-mainnet",
        llama: "solana",
    },
};

// Official public nodes as last resort
const PUBLIC_OFFICIAL: Record<SupportedRpcChain, string> = {
    ethereum: "https://sys.merkle.io/eth-mainnet",
    base: "https://mainnet.base.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    optimism: "https://mainnet.optimism.io",
    polygon: "https://polygon-rpc.com",
    bsc: "https://bsc-dataseed.binance.org",
    solana: "https://api.mainnet-beta.solana.com",
};

// Global rotation index (simple round-robin per chain)
const rotationIndex: Record<string, number> = {};

// Methods we explicitly do NOT allow proxying, even if they match prefixes.
const DISALLOWED_METHOD_PREFIXES = [
    "debug_",
    "personal_",
    "admin_",
    "anvil_",
    "txpool_",
    "miner_",
    "trace_",
];

function isMethodAllowed(method: unknown): method is string {
    if (typeof method !== "string" || method.length === 0 || method.length > 128) {
        return false;
    }

    if (DISALLOWED_METHOD_PREFIXES.some((prefix) => method.startsWith(prefix))) {
        return false;
    }

    const allowedPrefixes = [
        "eth_",
        "net_",
        "web3_",
        "arb_",
        "optimism_",
        "polygon_",
        "bsc_",
        "alchemy_",
        "qn_",
        "rpc.",
        "get", // Solana `get*` methods
        "sendTransaction",
        "simulateTransaction",
    ];

    return allowedPrefixes.some((prefix) => method.startsWith(prefix));
}

function sanitizeParams(params: unknown): any[] {
    if (!Array.isArray(params)) {
        throw new Error("RPC params must be an array");
    }

    if (params.length > 20) {
        throw new Error("RPC params too long");
    }

    try {
        const serialized = JSON.stringify(params);
        if (serialized.length > 10_000) {
            throw new Error("RPC params payload too large");
        }
    } catch {
        throw new Error("RPC params must be JSON-serializable");
    }

    return params;
}

/**
 * Build list of available RPC endpoints for a chain, based on available API keys.
 * Priorities: Helius (Solana) -> Ankr -> Infura -> Alchemy -> Public
 */
function getAvailableEndpoints(chain: SupportedRpcChain): RpcEndpoint[] {
    const endpoints: RpcEndpoint[] = [];
    const slugs = CHAIN_SLUGS[chain];

    // 0. Chainstack (Solana Mainnet Primary)
    if (chain === "solana" && (process.env.CHAINSTACK_SOLANA_MAINNET_RPC ?? "").length > 0) {
        endpoints.push({
            // reusing 'helius' provider type for now as it's just a label for solana logging
            provider: "helius",
            url: process.env.CHAINSTACK_SOLANA_MAINNET_RPC as string,
        });
    }

    // 0.5 Helius (Solana Only)
    if (chain === "solana" && (process.env.HELIUS_API_KEY ?? "").length > 0) {
        endpoints.push({
            provider: "helius",
            url: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        });
    }

    // 0.6 Alchemy (Solana Fallback specific key)
    if (chain === "solana" && (process.env.ALCHEMY_SOLANA_KEY ?? "").length > 0) {
        endpoints.push({
            provider: "alchemy",
            url: `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_SOLANA_KEY}`,
        });
    }

    // 1. Ankr (Premium / Standard)
    if ((process.env.ANKR_API_KEY ?? "").length > 0) {
        endpoints.push({
            provider: "ankr",
            url: `https://rpc.ankr.com/${slugs.ankr}/${process.env.ANKR_API_KEY}`,
        });
    }

    // 2. Infura
    if ((process.env.INFURA_API_KEY ?? "").length > 0 && slugs.infura) {
        endpoints.push({
            provider: "infura",
            url: `https://${slugs.infura}.infura.io/v3/${process.env.INFURA_API_KEY}`,
        });
    }

    // 3. Alchemy
    if ((process.env.ALCHEMY_API_KEY ?? "").length > 0) {
        endpoints.push({
            provider: "alchemy",
            url: `https://${slugs.alchemy}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        });
    }

    // 4. Llama (Public - Reliable)
    if (slugs.llama) {
        endpoints.push({
            provider: "public_llama",
            url: `https://${slugs.llama}.llamarpc.com`,
        });
    }

    // 5. Official Public (Last Resort) -- Limit usage for Solana
    if (chain !== "solana") {
        endpoints.push({
            provider: "public_official",
            url: PUBLIC_OFFICIAL[chain],
        });
    } else {
        // Solana-specific Fallbacks (if no optimized providers)
        // We avoid the generic public implementation for Solana mainnet as it's often rate-limited for DApps.
    }

    return endpoints;
}

/**
 * Get the next RPC URL for a chain using rotation logic.
 */
export function getRotatedRpcUrl(chain: SupportedRpcChain): string {
    const endpoints = getAvailableEndpoints(chain);
    if (endpoints.length === 0) {
        // Fallback for Solana if no keys are present (development/testing only)
        if (chain === "solana") return "https://api.mainnet-beta.solana.com";
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

    return current.url;
}

/**
 * Execute an RPC request through the rotated proxy.
 * Handles fetch logic and basic error wrapping.
 */
export async function executeRpcRequest(
    chain: SupportedRpcChain,
    method: string,
    params: any[],
) {
    if (!isMethodAllowed(method)) {
        throw new Error("Unsupported or unsafe JSON-RPC method");
    }

    const safeParams = sanitizeParams(params);

    // Get all available endpoints instead of just one
    const endpoints = getAvailableEndpoints(chain);

    if (endpoints.length === 0) {
        // Last ditch effort for Solana
        if (chain === "solana") {
            try {
                const response = await fetch("https://api.mainnet-beta.solana.com", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: safeParams }),
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                return data.result;
            } catch (e) {
                throw new Error(`All RPC endpoints failed for ${chain}. Last error: ${e}`);
            }
        }
        throw new Error(`No RPC endpoints available for ${chain}`);
    }

    let lastError: Error | null = null;

    // Try each endpoint in order
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: 1,
                    jsonrpc: "2.0",
                    method,
                    params: safeParams,
                }),
                signal: AbortSignal.timeout(10_000), // 10s timeout
            });

            if (!response.ok) {
                console.warn(
                    `RPC Provider ${endpoint.provider} refused connection: ${response.statusText}`,
                );
                throw new Error(
                    `RPC Provider refused connection: ${response.statusText}`,
                );
            }

            const data = await response.json();

            // Forward upstream errors if present
            if (data.error) {
                throw new Error(`RPC Error: ${data.error.message}`);
            }

            return data.result;
        } catch (err: any) {
            // Sanitize error messages to avoid exposing API keys
            const sanitizedMessage =
                err.message?.replace(
                    /api[_-]?key=([a-zA-Z0-9_-]+)/gi,
                    "api-key=***",
                ) || "Unknown error";
            console.warn(`RPC Provider ${endpoint.provider} failed:`, sanitizedMessage);
            lastError = err;
            // Continue to next endpoint
        }
    }

    // If loop finishes, all failed
    throw new Error(
        `All RPC endpoints failed for ${chain}. Last error: ${lastError?.message}`,
    );
}
