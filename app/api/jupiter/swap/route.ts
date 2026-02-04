import { NextRequest, NextResponse } from "next/server";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(address: unknown): address is string {
    return (
        typeof address === "string" &&
        address.length >= 32 &&
        address.length <= 44 &&
        SOLANA_ADDRESS_REGEX.test(address)
    );
}

type QuoteResponseMinimal = {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
};

function sanitizeQuoteResponse(raw: unknown): QuoteResponseMinimal | null {
    if (!raw || typeof raw !== "object") return null;
    const q = raw as Record<string, unknown>;

    const requiredStringFields = [
        "inputMint",
        "outputMint",
        "inAmount",
        "outAmount",
        "otherAmountThreshold",
    ] as const;

    for (const field of requiredStringFields) {
        if (typeof q[field] !== "string" || (q[field] as string).length === 0) {
            return null;
        }
    }

    // Basic Solana address validation on mints
    if (
        !isValidSolanaAddress(q.inputMint) ||
        !isValidSolanaAddress(q.outputMint)
    ) {
        return null;
    }

    // Amounts should be positive integer strings
    const intPattern = /^\d+$/;
    if (
        !intPattern.test(q.inAmount as string) ||
        !intPattern.test(q.outAmount as string) ||
        !intPattern.test(q.otherAmountThreshold as string)
    ) {
        return null;
    }

    // Slippage bounds (1bps - 5000bps)
    const slippageBps = Number(q.slippageBps);
    if (!Number.isFinite(slippageBps) || slippageBps <= 0 || slippageBps > 5000) {
        return null;
    }

    return {
        inputMint: q.inputMint as string,
        outputMint: q.outputMint as string,
        inAmount: q.inAmount as string,
        outAmount: q.outAmount as string,
        otherAmountThreshold: q.otherAmountThreshold as string,
        slippageBps,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { quoteResponse, userPublicKey, wrapAndUnwrapSol } = body ?? {};

        const sanitizedQuote = sanitizeQuoteResponse(quoteResponse);
        if (!sanitizedQuote || !isValidSolanaAddress(userPublicKey)) {
            return NextResponse.json(
                {
                    error:
                        "Invalid parameters: quoteResponse must be a valid Jupiter quote and userPublicKey must be a valid Solana address",
                },
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

        // Jupiter Swap API v6
        const url = "https://quote-api.jup.ag/v6/swap";

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                quoteResponse: sanitizedQuote,
                userPublicKey,
                wrapAndUnwrapSol: wrapAndUnwrapSol ?? true,
            }),
            // Do not cache swap transaction, it is time-sensitive
            cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Jupiter Swap Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
