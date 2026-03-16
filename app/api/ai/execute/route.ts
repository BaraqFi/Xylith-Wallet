import { NextRequest, NextResponse } from "next/server";
import {
    verifyPrivyToken,
    getPrivyUser,
    getEmbeddedEvmAddress,
} from "@/lib/ai/privyServer";
import { sanitizeError } from "@/lib/ai/errorSanitizer";
import { executeWithSessionKey, generateSessionKeySigner } from "@/lib/ai/alchemyServer";
import type { Hex } from "viem";

export const runtime = "nodejs";

type ExecuteBody = {
    calls: Array<{ to: string; value?: string; data?: string }>;
    chainId?: number;
};

/**
 * POST /api/ai/execute
 * Execute a transaction via the AI session key.
 *
 * Flow:
 * 1. Authenticate user via Privy token
 * 2. Validate active session from Privy metadata
 * 3. Build transaction calldata from the request
 * 4. Sign with session key via Alchemy Signer (Turnkey enclave)
 * 5. Submit through Alchemy bundler
 * 6. Return tx hash and status
 */
export async function POST(req: NextRequest) {
    try {
        const userId = await verifyPrivyToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }

        const user = await getPrivyUser(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Validate session
        const meta = user.custom_metadata;
        const sessionKey = meta?.alchemySessionKey as string | undefined;
        const sessionExpiry = meta?.sessionExpiry as number | undefined;

        if (!sessionKey || !sessionExpiry) {
            return NextResponse.json(
                { error: "No active AI session. Please activate AI mode first." },
                { status: 403 }
            );
        }

        const now = Math.floor(Date.now() / 1000);
        if (sessionExpiry <= now) {
            return NextResponse.json(
                { error: "Your AI session has expired. Please re-activate AI mode." },
                { status: 403 }
            );
        }

        // Get user's EOA address
        const evmAddress = getEmbeddedEvmAddress(user);
        if (!evmAddress) {
            return NextResponse.json(
                { error: "No embedded EVM wallet found." },
                { status: 400 }
            );
        }

        // Parse request body
        const body = (await req.json()) as ExecuteBody;

        if (!body.calls || !Array.isArray(body.calls) || body.calls.length === 0) {
            return NextResponse.json(
                { error: "Missing or invalid transaction calls." },
                { status: 400 }
            );
        }

        // Validate each call
        const formattedCalls = body.calls.map((call) => ({
            to: call.to as Hex,
            value: (call.value || "0x0") as Hex,
            data: (call.data || "0x") as Hex,
        }));

        // Build the permissions context from the stored session key address.
        // The session key address references the session managed by Alchemy's Turnkey enclave.
        const permissionsContext = { context: sessionKey as `0x${string}` };

        // The session key signer is managed by Alchemy's Turnkey enclave.
        const sessionKeySigner = generateSessionKeySigner();

        const result = await executeWithSessionKey(
            evmAddress as Hex,
            sessionKeySigner,
            permissionsContext,
            formattedCalls,
        );

        return NextResponse.json({
            status: "success",
            result: {
                id: result.id,
                txStatus: result.status,
                receipts: result.receipts,
            },
        });
    } catch (error) {
        console.error("AI Execute error:", error);
        return NextResponse.json(
            { error: sanitizeError(error) },
            { status: 500 }
        );
    }
}
