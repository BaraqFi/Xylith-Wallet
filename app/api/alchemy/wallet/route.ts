import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";

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
  // Wallet APIs require `wallet_*`. We also allow standard namespaces used by the SDK.
  const allowedPrefixes = [
    "wallet_",
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

/**
 * Raw JSON-RPC proxy to Alchemy Wallet APIs.
 *
 * IMPORTANT:
 * - Returns upstream JSON-RPC response shape (jsonrpc/id/result or error) so it can be used
 *   as a standard transport by viem / Account Kit on the client without exposing API keys.
 * - This route is intended for Wallet APIs (wallet_*), including EIP-7702 prepare/sign flows.
 */
export async function POST(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
  const apiKey = process.env.ALCHEMY_API_KEY; // server-side only
  if (!apiKey) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: 1, error: { code: -32603, message: "Alchemy API key not configured" } },
      { status: 500 },
    );
  }

  try {
    const chain = req.nextUrl.searchParams.get("chain");
    if (!isSupportedChain(chain)) {
      return NextResponse.json(
        { jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Missing or unsupported chain" } },
        { status: 400 },
      );
    }

    const body = await req.json();
    const method = body?.method;
    if (!isMethodAllowed(method)) {
      return NextResponse.json(
        { jsonrpc: "2.0", id: body?.id ?? 1, error: { code: -32601, message: "Unsupported method" } },
        { status: 400 },
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

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const text = await upstream.text();
    // Forward upstream status and body; avoid leaking API keys (none present in body).
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to proxy wallet request";
    const sanitized = msg.replace(/api[_-]?key=([a-zA-Z0-9_-]+)/gi, "api-key=***");
    console.error("Alchemy Wallet proxy error:", sanitized);
    return NextResponse.json(
      { jsonrpc: "2.0", id: 1, error: { code: -32603, message: "Internal error" } },
      { status: 500 },
    );
  }
}

