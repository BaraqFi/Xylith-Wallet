import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(address: string | null): address is string {
    return !!address && SOLANA_ADDRESS_REGEX.test(address);
}

function isValidPositiveIntegerString(value: string | null): value is string {
    if (!value) return false;
    if (!/^\d+$/.test(value)) return false;
    // Guard against absurdly large values (e.g. > 1e30)
    return value.length <= 30;
}

function parseSlippageBps(raw: string | null): number | null {
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    // Reasonable bounds: 1bps - 5000bps (0.01% - 50%)
    if (num <= 0 || num > 5000) return null;
    return num;
}

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    const searchParams = req.nextUrl.searchParams;
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const slippageBpsRaw = searchParams.get("slippageBps");

    if (!isValidSolanaAddress(inputMint) || !isValidSolanaAddress(outputMint)) {
        return NextResponse.json(
            { error: "Invalid inputMint or outputMint address" },
            { status: 400 },
        );
    }

    if (!isValidPositiveIntegerString(amount)) {
        return NextResponse.json(
            { error: "Invalid amount; must be a positive integer string" },
            { status: 400 },
        );
    }

    const slippageBps = slippageBpsRaw ? parseSlippageBps(slippageBpsRaw) : null;
    if (slippageBpsRaw && slippageBps === null) {
        return NextResponse.json(
            { error: "Invalid slippageBps; must be between 1 and 5000" },
            { status: 400 },
        );
    }

    const apiKey = process.env.JUPITER_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration: No API Key" },
            { status: 500 },
        );
    }

    // Jupiter Quote API v6
    const url = new URL("https://quote-api.jup.ag/v6/quote");
    url.searchParams.append("inputMint", inputMint);
    url.searchParams.append("outputMint", outputMint);
    url.searchParams.append("amount", amount);
    if (slippageBps !== null) {
        url.searchParams.append("slippageBps", String(slippageBps));
    }

    try {
        const res = await fetch(url.toString(), {
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            // Cache for 10 seconds to avoid hitting rate limits too fast on same duplicate requests
            next: { revalidate: 10 },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Jupiter Quote Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
