import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side API route for Alchemy token metadata
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ALCHEMY_API_KEY; // Server-side only
  if (!apiKey) {
    return NextResponse.json(
      { error: "Alchemy API key not configured" },
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
        method: "alchemy_getTokenMetadata",
        params: [contractAddress],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ metadata: null });
    }

    return NextResponse.json({
      metadata: {
        name: data.result?.name,
        symbol: data.result?.symbol,
        decimals: data.result?.decimals,
        logo: data.result?.logo,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching token metadata:", error);
    let message = "Failed to fetch token metadata";
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

