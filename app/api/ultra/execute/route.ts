import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";

function isLikelyBase64(value: unknown): value is string {
    if (typeof value !== "string" || value.length === 0) return false;
    // Basic base64 pattern; we do not try to be perfect, just prevent obvious abuse
    return /^[A-Za-z0-9+/=]+$/.test(value) && value.length <= 50000;
}

function isLikelyRequestId(value: unknown): value is string {
    if (typeof value !== "string" || value.length === 0) return false;
    // Ultra uses UUID-like request IDs; enforce a sane length and charset
    return /^[0-9a-fA-F-]{8,64}$/.test(value);
}

export async function POST(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    try {
        const body = await req.json();
        const { signedTransaction, requestId } = body ?? {};

        if (!isLikelyBase64(signedTransaction) || !isLikelyRequestId(requestId)) {
            return NextResponse.json(
                {
                    error:
                        "Invalid parameters: signedTransaction must be base64 and requestId must be a valid identifier",
                },
                { status: 400 },
            );
        }

        const apiKey =
            process.env.ULTRA_API_KEY || process.env.JUPITER_API_KEY || null;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Server misconfiguration: No API Key" },
                { status: 500 },
            );
        }

        const url = "https://api.jup.ag/ultra/v1/execute";

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                signedTransaction,
                requestId,
            }),
            cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Ultra Execute Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}

