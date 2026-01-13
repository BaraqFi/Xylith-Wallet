import { NextRequest, NextResponse } from "next/server";
import { executeRpcRequest } from "@/lib/services/serverRpc";
import { EVMChain } from "@/components/wallet/data";

export async function POST(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const chainRaw = searchParams.get("chain");

        if (!chainRaw) {
            return NextResponse.json(
                { error: "Missing 'chain' query parameter" },
                { status: 400 }
            );
        }

        const chain = chainRaw as EVMChain;
        // Basic validation of chain (could be more robust if we exported the EVMChain values)
        const validChains = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc'];
        if (!validChains.includes(chain)) {
            return NextResponse.json(
                { error: `Unsupported chain: ${chain}` },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { method, params } = body;

        if (!method) {
            return NextResponse.json(
                { error: "Missing JSON-RPC 'method'" },
                { status: 400 }
            );
        }

        const result = await executeRpcRequest(chain, method, params || []);

        return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id || 1,
            result: result,
        });
    } catch (error: any) {
        console.error("RPC Proxy Error:", error);
        return NextResponse.json(
            {
                jsonrpc: "2.0",
                id: 1,
                error: {
                    code: -32603,
                    message: error.message || "Internal RPC Error",
                }
            },
            { status: 500 }
        );
    }
}
