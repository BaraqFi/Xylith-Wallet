import { NextRequest, NextResponse } from "next/server";
import { EVMChain } from "@/components/wallet/data";

/**
 * Server-side API route for Moralis token balances
 * Uses Moralis API to fetch ERC20 token balances for a wallet address
 * PRIMARY provider for token detection - better coverage and includes metadata/prices
 * Falls back to Alchemy if Moralis fails
 */

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

// Map our internal chain names to Moralis chain strings
const MORALIS_CHAIN_MAP: Record<EVMChain, string> = {
  ethereum: "eth",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
  polygon: "polygon",
  bsc: "bsc",
};

export async function POST(req: NextRequest) {
  if (!MORALIS_API_KEY) {
    return NextResponse.json(
      { error: "Moralis API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { address, chain } = await req.json();

    if (!address || !chain) {
      return NextResponse.json(
        { error: "Missing address or chain" },
        { status: 400 }
      );
    }

    const moralisChain = MORALIS_CHAIN_MAP[chain as EVMChain];
    if (!moralisChain) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    // Use the /wallets/:address/tokens endpoint which includes prices
    // This is better than /erc20 as it includes USD values
    const apiUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=${moralisChain}&exclude_spam=false&limit=2000`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
      // Add timeout
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Moralis API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Moralis returns { result: [...], page, page_size, etc }
    const tokens = data.result || [];

    // Transform Moralis response to match our Alchemy format
    const balances = tokens
      .filter((token: any) => {
        // Filter out zero balances and native tokens (we handle native separately)
        const balance = token.balance || "0";
        return balance !== "0" && balance !== "0x0" && token.token_address !== "";
      })
      .map((token: any) => ({
        contractAddress: token.token_address?.toLowerCase() || null,
        tokenBalance: token.balance || "0x0",
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals || 18,
        logo: token.logo || token.thumbnail,
        usdValue: parseFloat(token.usd_value || "0"),
        pricePerToken: parseFloat(token.usd_price || "0"),
      }));

    return NextResponse.json({ balances });
  } catch (error: any) {
    // Sanitize error messages
    const sanitizedMessage = error.message?.replace(/api[_-]?key=([a-zA-Z0-9_-]+)/gi, 'api-key=***') || 'Unknown error';
    console.error("Error fetching Moralis token balances:", sanitizedMessage);
    
    // Don't expose full error details
    return NextResponse.json(
      { error: "Failed to fetch token balances from Moralis" },
      { status: 500 }
    );
  }
}
