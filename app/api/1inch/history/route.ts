import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

const ALLOWED_FORWARD_PARAMS = new Set(["limit", "offset", "page", "sort"]);

function isValidChainId(chainId: string | null): chainId is string {
    if (!chainId) return false;
    if (!/^\d+$/.test(chainId)) return false;
    // Basic guardrail: limit to reasonable EVM chainId range
    const num = Number(chainId);
    return Number.isInteger(num) && num > 0 && num < 10_000;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const chainId = searchParams.get("chainId");
    const address = searchParams.get("address");

    if (!isValidChainId(chainId)) {
        return NextResponse.json(
            { error: "Invalid or missing chainId" },
            { status: 400 },
        );
    }
    if (!address || !isAddress(address)) {
        return NextResponse.json(
            { error: "Invalid or missing address" },
            { status: 400 },
        );
    }

    const apiKey = process.env.ONE_INCH_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration: No API Key" },
            { status: 500 },
        );
    }

    // 1inch History API v2.0
    // Endpoint: https://api.1inch.dev/history/v2.0/transactions/{address}?chainId={chainId}
    // There are other valid params like limit, offset.

    // Clean params to forward (allowlist to avoid parameter pollution)
    const forwardParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
        if (key === "address" || key === "chainId") return;
        if (!ALLOWED_FORWARD_PARAMS.has(key)) return;
        forwardParams.append(key, value);
    });

    const baseUrl = new URL(
        `https://api.1inch.dev/history/v2.0/transactions/${address}`,
    );
    baseUrl.searchParams.set("chainId", chainId);
    for (const [key, value] of forwardParams.entries()) {
        baseUrl.searchParams.append(key, value);
    }

    try {
        const res = await fetch(baseUrl.toString(), {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            next: { revalidate: 30 }, // Cache for 30 seconds
        });

        // Lightweight status logging without full URL/body to avoid leaking sensitive data
        console.log(`[1inch History API] Status: ${res.status}`);

        // Check if response has content before parsing JSON
        const contentType = res.headers.get("content-type");
        const text = await res.text();

        // If response is empty or not JSON, handle gracefully
        if (!text || !contentType?.includes("application/json")) {
            if (!res.ok) {
                return NextResponse.json(
                    { error: `1inch API error: ${res.status} ${res.statusText}` },
                    { status: res.status },
                );
            }
            return NextResponse.json([]);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("1inch History JSON Parse Error:", parseError);
            if (!res.ok) {
                return NextResponse.json(
                    { error: "Invalid JSON response from 1inch API" },
                    { status: 500 },
                );
            }
            return NextResponse.json([]);
        }

        if (!res.ok) {
            if (res.status === 404) {
                console.warn(
                    `[1inch History API] 404 for address on chain ${chainId}`,
                );
                return NextResponse.json({ items: [] });
            }

            const errorMessage =
                data?.error ||
                data?.message ||
                `1inch API error: ${res.status} ${res.statusText}`;
            console.error(`[1inch History API] Error ${res.status}`);
            return NextResponse.json(
                {
                    error: errorMessage,
                    status: res.status,
                    hint:
                        res.status === 403
                            ? "API key may not have History API access. Check your 1inch Developer Portal plan."
                            : undefined,
                },
                { status: res.status },
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("1inch History Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
