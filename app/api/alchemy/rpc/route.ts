import { NextRequest, NextResponse } from "next/server";

type SupportedAlchemyChain =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bsc";

const DISALLOWED_METHOD_PREFIXES = [
  "debug_",
  "personal_",
  "admin_",
  "anvil_",
  "txpool_",
  "miner_",
  "trace_",
];

function isSupportedChain(chain: string | null): chain is SupportedAlchemyChain {
  if (!chain) return false;
  return (
    chain === "ethereum" ||
    chain === "base" ||
    chain === "arbitrum" ||
    chain === "optimism" ||
    chain === "polygon" ||
    chain === "bsc"
  );
}

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
  ];

  return allowedPrefixes.some((prefix) => method.startsWith(prefix));
}

function sanitizeParams(params: unknown): unknown[] {
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
 * Server-side proxy for Alchemy RPC calls
 * This prevents API key exposure when using RPC URLs
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
    const body = await req.json();
    const { chain, method, params } = body ?? {};

    if (!isSupportedChain(chain)) {
      return NextResponse.json(
        { error: "Missing or unsupported chain" },
        { status: 400 }
      );
    }

    if (!isMethodAllowed(method)) {
      return NextResponse.json(
        { error: "Unsupported or unsafe JSON-RPC method" },
        { status: 400 }
      );
    }

    let safeParams: unknown[];
    try {
      safeParams = sanitizeParams(params ?? []);
    } catch (e: unknown) {
      let message = "Invalid JSON-RPC params";
      if (e instanceof Error) {
        message = e.message;
      }
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    const chainMap: Record<SupportedAlchemyChain, string> = {
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
        id: typeof body?.id === "number" || typeof body?.id === "string" ? body.id : 1,
        jsonrpc: "2.0",
        method,
        params: safeParams,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    return NextResponse.json({ result: data.result });
  } catch (error: unknown) {
    let message = "Failed to process RPC request";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    
    const sanitizedMessage = message.replace(
      /api[_-]?key=([a-zA-Z0-9_-]+)/gi,
      "api-key=***",
    );

    console.error("Error in Alchemy RPC proxy:", sanitizedMessage);
    return NextResponse.json(
      { error: "Failed to process RPC request" },
      { status: 500 }
    );
  }
}

