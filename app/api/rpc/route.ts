import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { executeRpcRequest } from "@/lib/services/serverRpc";

const VALID_CHAINS = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "bsc",
    "solana",
] as const;

type RpcChain = (typeof VALID_CHAINS)[number];

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

function isSupportedChain(chain: string): chain is RpcChain {
    return (VALID_CHAINS as readonly string[]).includes(chain);
}

function isMethodAllowed(method: unknown): method is string {
    if (typeof method !== "string" || method.length === 0 || method.length > 128) {
        return false;
    }

    if (DISALLOWED_METHOD_PREFIXES.some((prefix) => method.startsWith(prefix))) {
        return false;
    }

    // Allow common JSON-RPC namespaces used by EVM providers and Solana RPC.
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

function sanitizeParams(params: unknown): unknown[] | null {
    if (!Array.isArray(params)) {
        return null;
    }

    // Basic guardrails: limit depth/size to avoid abuse.
    if (params.length > 20) {
        return null;
    }

    try {
        const serialized = JSON.stringify(params);
        // ~10KB payload cap
        if (serialized.length > 10_000) {
            return null;
        }
    } catch {
        return null;
    }

    return params;
}

export async function POST(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    try {
        const searchParams = req.nextUrl.searchParams;
        const chainRaw = searchParams.get("chain");

        if (!chainRaw) {
            return NextResponse.json(
                { error: "Missing 'chain' query parameter" },
                { status: 400 },
            );
        }

        if (!isSupportedChain(chainRaw)) {
            return NextResponse.json(
                { error: `Unsupported chain: ${chainRaw}` },
                { status: 400 },
            );
        }

        const body = await req.json();
        const { method, params } = body ?? {};

        if (!isMethodAllowed(method)) {
            return NextResponse.json(
                { error: "Unsupported or unsafe JSON-RPC method" },
                { status: 400 },
            );
        }

        const safeParams = sanitizeParams(params ?? []);
        if (!safeParams) {
            return NextResponse.json(
                { error: "Invalid or oversized JSON-RPC params" },
                { status: 400 },
            );
        }

        const result = await executeRpcRequest(chainRaw, method, safeParams);

        return NextResponse.json({
            jsonrpc: "2.0",
            id: typeof body?.id === "number" || typeof body?.id === "string" ? body.id : 1,
            result,
        });
      } catch (error: unknown) {
        let message = "Internal RPC Error";
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === 'string') {
          message = error;
        }
        // Sanitize error message to avoid exposing API keys
        const sanitizedMessage =
          message.replace(
            /api[_-]?key=([a-zA-Z0-9_-]+)/gi,
            "api-key=***",
          ) || "Internal RPC Error";
    
        console.error("RPC Proxy Error:", sanitizedMessage);
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32603,
              message: sanitizedMessage,
            },
          },
          { status: 500 },
        );
      }}
