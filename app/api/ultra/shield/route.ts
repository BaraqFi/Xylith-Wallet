import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(address: string): boolean {
    return SOLANA_ADDRESS_REGEX.test(address);
}

function parseMintsParam(raw: string | null): string[] | null {
    if (!raw) return null;
    const parts = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length === 0 || parts.length > 100) return null;
    if (!parts.every((m) => isValidSolanaAddress(m))) return null;
    return parts;
}

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    const searchParams = req.nextUrl.searchParams;
    const mintsRaw = searchParams.get("mints");

    const mints = parseMintsParam(mintsRaw);
    if (!mints) {
        return NextResponse.json(
            { error: "Invalid or missing mints parameter" },
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

    try {
        const response = await fetch(
            `https://api.jup.ag/ultra/v1/shield?mints=${encodeURIComponent(mints.join(","))}`,
            {
                headers: {
                    "x-api-key": apiKey,
                    Accept: "application/json",
                },
                next: { revalidate: 30 },
            },
        );

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        const warnings =
            data && typeof data.warnings === "object" ? data.warnings : {};

        return NextResponse.json({ warnings });
    } catch (error) {
        console.error("Ultra Shield Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch shield warnings" },
            { status: 500 },
        );
    }
}

