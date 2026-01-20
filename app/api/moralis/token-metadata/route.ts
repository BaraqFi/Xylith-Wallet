import { NextRequest, NextResponse } from "next/server";
import { EVMChain } from "@/components/wallet/data";
import { isValidContractAddress } from "@/lib/services/tokenMetadataService";

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

// Map our internal chain IDs to Moralis chain strings
const CHAIN_MAP: Record<EVMChain, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
    polygon: "polygon",
    bsc: "bsc",
};

/**
 * Server-side API route for Moralis token metadata
 * Primary source for token metadata with CoinGecko fallback
 */
export async function POST(req: NextRequest) {
    if (!MORALIS_API_KEY) {
        return NextResponse.json(
            { error: "Moralis API key not configured" },
            { status: 500 }
        );
    }

    try {
        const { contractAddress, chain } = await req.json();

        if (!contractAddress || !chain) {
            return NextResponse.json(
                { error: "Missing contractAddress or chain" },
                { status: 400 }
            );
        }

        if (!isValidContractAddress(contractAddress)) {
            return NextResponse.json(
                { error: "Invalid contract address format" },
                { status: 400 }
            );
        }

        const moralisChain = CHAIN_MAP[chain as EVMChain] || "eth";

        // Fetch from Moralis
        const url = `https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain=${moralisChain}&addresses%5B0%5D=${contractAddress}`;
        const response = await fetch(url, {
            headers: {
                accept: "application/json",
                "X-API-Key": MORALIS_API_KEY,
            },
        });

        if (!response.ok) {
            // Try CoinGecko fallback
            return await tryCoinGeckoFallback(contractAddress, chain as EVMChain);
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            // Try CoinGecko fallback
            return await tryCoinGeckoFallback(contractAddress, chain as EVMChain);
        }

        const token = data[0];
        return NextResponse.json({
            metadata: {
                name: token.name,
                symbol: token.symbol,
                decimals: parseInt(token.decimals) || 18,
                logo: token.logo || token.thumbnail,
            },
        });
    } catch (error: any) {
        console.error("Error fetching token metadata from Moralis:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch token metadata" },
            { status: 500 }
        );
    }
}

/**
 * Fallback to CoinGecko for token metadata
 */
async function tryCoinGeckoFallback(
    contractAddress: string,
    chain: EVMChain
): Promise<NextResponse> {
    try {
        const COINGECKO_PLATFORM_MAP: Record<EVMChain, string> = {
            ethereum: "ethereum",
            base: "base",
            arbitrum: "arbitrum-one",
            optimism: "optimistic-ethereum",
            polygon: "polygon-pos",
            bsc: "binance-smart-chain",
        };

        const platform = COINGECKO_PLATFORM_MAP[chain];
        if (!platform) {
            return NextResponse.json({ metadata: null });
        }

        // CoinGecko contract address lookup
        const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress.toLowerCase()}`;
        const response = await fetch(url, {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!response.ok) {
            return NextResponse.json({ metadata: null });
        }

        const data = await response.json();
        return NextResponse.json({
            metadata: {
                name: data.name,
                symbol: data.symbol?.toUpperCase(),
                decimals: 18, // CoinGecko doesn't always provide decimals
                logo: data.image?.small || data.image?.thumb,
            },
        });
    } catch (error) {
        console.warn("CoinGecko fallback also failed:", error);
        return NextResponse.json({ metadata: null });
    }
}
