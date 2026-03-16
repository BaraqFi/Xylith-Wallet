import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side API route for Alchemy native balance
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
    // Some callers may send an empty body; guard to avoid throwing a SyntaxError.
    const raw = await req.text();
    if (!raw) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }
    const { address, chain } = JSON.parse(raw) as { address?: string; chain?: string };

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
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    return NextResponse.json({ balance: data.result || "0x0" });
  } catch (error: unknown) {
    console.error("Error fetching native balance:", error);
    let message = "Failed to fetch native balance";
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

