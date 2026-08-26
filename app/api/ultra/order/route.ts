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

function parseReferralFee(raw: string | null): number | null {
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    // Reasonable bounds: 0 - 1000 bps (0% - 10%)
    if (num < 0 || num > 1000) return null;
    return num;
}

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    const searchParams = req.nextUrl.searchParams;
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const taker = searchParams.get("taker");
    const referralAccount = searchParams.get("referralAccount");
    const referralFeeRaw = searchParams.get("referralFee");

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

    if (taker && !isValidSolanaAddress(taker)) {
        return NextResponse.json(
            { error: "Invalid taker address" },
            { status: 400 },
        );
    }

    if (referralAccount && !isValidSolanaAddress(referralAccount)) {
        return NextResponse.json(
            { error: "Invalid referralAccount address" },
            { status: 400 },
        );
    }

    const referralFee =
        referralFeeRaw !== null ? parseReferralFee(referralFeeRaw) : null;
    if (referralFeeRaw !== null && referralFee === null) {
        return NextResponse.json(
            { error: "Invalid referralFee; must be between 0 and 1000 bps" },
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

    const url = new URL("https://api.jup.ag/ultra/v1/order");
    url.searchParams.append("inputMint", inputMint);
    url.searchParams.append("outputMint", outputMint);
    url.searchParams.append("amount", amount);
    if (taker) {
        url.searchParams.append("taker", taker);
    }
    if (referralAccount) {
        url.searchParams.append("referralAccount", referralAccount);
    }
    if (referralFee !== null) {
        url.searchParams.append("referralFee", String(referralFee));
    }

    try {
        const res = await fetch(url.toString(), {
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            // Short cache to avoid hammering Ultra for identical requests
            next: { revalidate: 5 },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Ultra Order Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}

