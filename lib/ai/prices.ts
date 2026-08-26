import { Chain } from "./types";
import { getPriceEstimate } from "./cryptoService";

/**
 * Fetch a live USD price for a chain's native token via the server price proxy,
 * falling back to the static estimate only if the live fetch fails. Replaces the
 * previously hardcoded prices used for USD->token amount math.
 */
export async function getLiveUsdPrice(chain: Chain): Promise<number> {
  const symbol = chain === "SOL" ? "SOL" : "ETH";
  try {
    const res = await fetch("/api/prices/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: [{ symbol }], currency: "usd" }),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, number>;
      const p = data[symbol];
      if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
    }
  } catch {
    // fall through to static estimate
  }
  return getPriceEstimate(chain);
}
