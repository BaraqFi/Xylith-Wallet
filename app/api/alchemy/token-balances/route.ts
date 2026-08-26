import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { isAddress } from "viem";

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error: string | null;
}

type SupportedAlchemyChain =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bsc";

function isSupportedChain(chain: string | null): chain is SupportedAlchemyChain {
  if (!chain) return false;
  return (
    chain === "ethereum" ||
    chain === "base" ||
    chain === "arbitrum" ||
    chain === "optimism" ||
    chain === "polygon" ||
    chain === "bsc"
  );
}

/**
 * Server-side API route for Alchemy token balances
 * This prevents API key exposure to client-side code
 */
export async function POST(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
  const apiKey = process.env.ALCHEMY_API_KEY; // Server-side only, no NEXT_PUBLIC_ prefix
  if (!apiKey) {
    return NextResponse.json(
      { error: "Alchemy API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { address, chain } = await req.json();

    if (!address || !isAddress(address) || !isSupportedChain(chain)) {
      return NextResponse.json(
        { error: "Invalid or missing address or chain" },
        { status: 400 }
      );
    }

    const chainMap: Record<SupportedAlchemyChain, string> = {
      ethereum: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
      base: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
      arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
      optimism: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
      polygon: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
      bsc: `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`,
    };

    const apiUrl = chainMap[chain];
    if (!apiUrl) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    // Add timeout and conservative retry logic
    const fetchWithTimeout = async (
      url: string,
      options: RequestInit,
      timeout = 5000
    ) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timeout");
        }
        throw error;
      }
    };

    let response;
    let lastError: Error | null = null;
    const maxRetries = 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetchWithTimeout(
          apiUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "alchemy_getTokenBalances",
              params: [address],
            }),
          },
          5000
        );

        if (response.ok) break;
      } catch (error: unknown) {
        if (error instanceof Error) {
            lastError = error;
        } else {
            lastError = new Error(String(error));
        }
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
          continue;
        }
        throw error;
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to fetch token balances after retries");
    }

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    // Filter out tokens with errors and zero balances
    const balances = (data.result?.tokenBalances || []).filter(
      (token: AlchemyTokenBalance) =>
        !token.error &&
        token.tokenBalance !== "0x0" &&
        token.tokenBalance !== "0"
    );

    return NextResponse.json({ balances });
  } catch (error: unknown) {
    console.error("Error fetching token balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch token balances" },
      { status: 500 }
    );
  }
}

