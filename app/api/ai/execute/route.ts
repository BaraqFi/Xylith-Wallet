import { NextRequest, NextResponse } from "next/server";
import {
    verifyPrivyToken,
    getPrivyUser,
    getEmbeddedEvmAddress,
} from "@/lib/ai/privyServer";
import { sanitizeError } from "@/lib/ai/errorSanitizer";
import { executeWithSessionKey } from "@/lib/ai/alchemyServer";
import { decryptSessionKeyHex } from "@/lib/ai/sessionKeyCrypto";
import { assertAiEnv } from "@/lib/ai/env";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, putSession } from "@/lib/ai/sessionStore";
import { getTokenPricesBatch } from "@/lib/services/tokenAnalyticsService";
import { executeRpcRequest } from "@/lib/services/serverRpc";
import { LocalAccountSigner } from "@aa-sdk/core";
import { isAddress, isHex, type Hex } from "viem";

export const runtime = "nodejs";

type ExecuteBody = {
    calls: Array<{ to: string; value?: string; data?: string }>;
    chainId?: number;
    /** Estimated USD value of this transaction, for server-side spend accounting. */
    amountUsd?: number;
};

/** Window length in seconds for a spend period. */
const PERIOD_SECONDS: Record<string, number> = {
    DAILY: 24 * 60 * 60,
    WEEKLY: 7 * 24 * 60 * 60,
};

/** Read a mainnet balance in wei through the internal RPC stack, or null. */
async function getNativeBalanceWei(address: Hex): Promise<bigint | null> {
    try {
        const hex = await executeRpcRequest("ethereum", "eth_getBalance", [
            address,
            "latest",
        ]);
        return typeof hex === "string" ? BigInt(hex) : null;
    } catch {
        return null;
    }
}

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
        assertAiEnv();

        const userId = await verifyPrivyToken(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }

        const limited = await rateLimit(req, { limit: 30, windowSec: 60 });
        if (limited) return limited;

        const user = await getPrivyUser(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Validate session (Redis when configured, else Privy metadata)
        const session = (await getSession(userId, user)) ?? {};
        const sessionKey = session.sessionKeyAddress;
        const sessionExpiry = session.sessionExpiry;
        const sessionPermissionsRaw = session.sessionPermissions;
        const sessionKeyEnc = session.sessionKeyEnc;

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

        if (!sessionKeyEnc) {
            return NextResponse.json(
                { error: "AI session key not available. Please re-activate AI mode." },
                { status: 403 }
            );
        }

        if (!sessionPermissionsRaw) {
            return NextResponse.json(
                { error: "AI session permissions not installed. Please re-activate AI mode." },
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

        // Validate and normalize each call: `to` must be a real address; value/data
        // must be well-formed hex. Malformed calls are rejected before signing.
        const formattedCalls: Array<{ to: Hex; value: Hex; data: Hex }> = [];
        for (const call of body.calls) {
            if (!call || typeof call.to !== "string" || !isAddress(call.to)) {
                return NextResponse.json(
                    { error: "Invalid transaction target address." },
                    { status: 400 }
                );
            }
            const value = call.value ?? "0x0";
            const data = call.data ?? "0x";
            if (typeof value !== "string" || !isHex(value) || typeof data !== "string" || !isHex(data)) {
                return NextResponse.json(
                    { error: "Invalid transaction value or calldata." },
                    { status: 400 }
                );
            }
            formattedCalls.push({ to: call.to as Hex, value: value as Hex, data: data as Hex });
        }

        // Server-side spend accounting (UX-layer; the on-chain allowance is the hard cap).
        // Reset the counter when the configured period has elapsed, then reject if this
        // transaction would push cumulative spend over the user's limit.
        const spendLimitUsd = session.spendLimitUsd ?? 0;
        const clientAmountUsd =
            typeof body.amountUsd === "number" && body.amountUsd > 0 ? body.amountUsd : 0;

        // Value the native ETH actually moved by these calls at the live price,
        // and take the max of that and the client's estimate. The client figure
        // alone is trivially understated by a hostile caller; the derived figure
        // alone misses anything not expressed as call value. Price-fetch failure
        // falls back to the client estimate (the on-chain allowance still caps).
        let derivedUsd = 0;
        const totalValueWei = formattedCalls.reduce(
            (sum, call) => sum + BigInt(call.value),
            BigInt(0),
        );
        if (totalValueWei > BigInt(0)) {
            try {
                const prices = await getTokenPricesBatch([{ symbol: "ETH" }], "usd");
                const ethUsd = prices["ETH"];
                if (typeof ethUsd === "number" && Number.isFinite(ethUsd) && ethUsd > 0) {
                    derivedUsd = (Number(totalValueWei) / 1e18) * ethUsd;
                }
            } catch {
                // fall back to the client estimate below
            }
        }
        const amountUsd = Math.max(derivedUsd, clientAmountUsd);
        let spentUsd = session.spentUsd ?? 0;
        let periodStart = session.periodStart ?? now;
        if (spendLimitUsd > 0) {
            const windowSec = PERIOD_SECONDS[session.spendPeriod ?? "DAILY"] ?? PERIOD_SECONDS.DAILY;
            if (now - periodStart >= windowSec) {
                spentUsd = 0;
                periodStart = now;
            }
            if (spentUsd + amountUsd > spendLimitUsd) {
                return NextResponse.json(
                    { error: "This transaction would exceed your spending limit." },
                    { status: 403 }
                );
            }
        }

        let permissionsContext: unknown = null;
        try {
            permissionsContext = JSON.parse(sessionPermissionsRaw);
        } catch {
            return NextResponse.json(
                { error: "AI session permissions are corrupted. Please re-activate AI mode." },
                { status: 403 }
            );
        }

        // Decrypt the stored session key private key and reconstruct a signer.
        // A decrypt failure means the secret was rotated (or the payload is stale/
        // tampered): fail closed and ask the user to re-activate rather than 500.
        let sessionKeyPrivateKey: string;
        try {
            sessionKeyPrivateKey = decryptSessionKeyHex(sessionKeyEnc);
        } catch {
            return NextResponse.json(
                { error: "Your AI session is no longer valid. Please re-activate AI mode." },
                { status: 403 }
            );
        }
        const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(
            sessionKeyPrivateKey as Hex,
        );

        // Preflight: a 7702 user operation costs several times a plain transfer,
        // so an account that can afford the amount may still not afford the
        // operation carrying it. Catching that here gives an actionable message
        // instead of an opaque bundler rejection surfacing as a 500.
        try {
            const balance = await getNativeBalanceWei(evmAddress as Hex);
            if (balance !== null) {
                const spend = formattedCalls.reduce(
                    (sum, call) => sum + BigInt(call.value),
                    BigInt(0),
                );
                if (balance <= spend) {
                    return NextResponse.json(
                        {
                            error:
                                "Not enough ETH to cover this transaction plus network fees. Try a smaller amount or top up.",
                        },
                        { status: 400 },
                    );
                }
            }
        } catch (preflightError) {
            // Never block execution on a preflight read failure.
            console.warn("Execute preflight balance check failed:", preflightError);
        }

        const result = await executeWithSessionKey(
            evmAddress as Hex,
            sessionKeySigner,
            permissionsContext,
            formattedCalls,
        );

        // Record spend for the period (best-effort; never fail the response on a
        // metadata write hiccup — the on-chain allowance remains the hard cap).
        if (spendLimitUsd > 0 && amountUsd > 0) {
            try {
                await putSession(userId, {
                    spentUsd: spentUsd + amountUsd,
                    periodStart,
                }, user.custom_metadata);
            } catch {
                // ignore accounting write failure
            }
        }

        return NextResponse.json({
            status: "success",
            result: {
                id: result.id,
                txStatus: result.status,
                receipts: result.receipts,
            },
        });
    } catch (error) {
        // Log the full error server-side: the client only ever receives a
        // sanitized message, which made bundler rejections indistinguishable
        // from genuine server faults.
        const detail = error instanceof Error ? error.message : String(error);
        console.error("AI Execute error:", detail, error);

        const friendly = sanitizeError(error);
        // A rejected transaction is the caller's problem to act on, not a server
        // fault — return 400 so it reads as "this didn't go through, here's why".
        const isTransactionRejection =
            /AA\d\d|prefund|insufficient|permission|session|reverted|gas/i.test(detail);

        return NextResponse.json(
            { error: friendly },
            { status: isTransactionRejection ? 400 : 500 }
        );
    }
}
