import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side API route for Alchemy token balances
 * This prevents API key exposure to client-side code
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ALCHEMY_API_KEY; // Server-side only, no NEXT_PUBLIC_ prefix
  if (!apiKey) {
    return NextResponse.json(
      { error: "Alchemy API key not configured" },
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

    const chainMap: Record<string, string> = {
      ethereum: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
      base: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
      arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
      optimism: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
      polygon: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
      bsc: `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`,
    };

    const apiUrl = chainMap[chain];
    if (!apiUrl) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    // Filter out tokens with errors and zero balances
    const balances = (data.result?.tokenBalances || []).filter(
      (token: any) => !token.error && token.tokenBalance !== "0x0" && token.tokenBalance !== "0"
    );

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error("Error fetching token balances:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch token balances" },
      { status: 500 }
    );
  }
}

