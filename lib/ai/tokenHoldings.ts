import { TokenBalance, isNativeTokenAddress } from "@/components/wallet/data";
import { Chain } from "./types";

/**
 * A token the user actually holds, normalized for AI mode.
 *
 * AI mode deliberately only knows about tokens with a non-zero balance on the
 * chains it supports (Ethereum mainnet + Solana). Anything else is out of
 * vocabulary, so the agent can never act on a token the wallet doesn't hold.
 */
export interface AiTokenHolding {
  chain: Chain;
  symbol: string;
  name: string;
  /** ERC-20 contract / SPL mint. Undefined for the chain's native asset. */
  address?: string;
  decimals: number;
  amount: number;
  usdValue: number;
  pricePerToken: number;
  isNative: boolean;
}

const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

function isNativeFor(chain: Chain, address?: string): boolean {
  if (chain === "SOL") return !address || address === SOL_NATIVE_MINT;
  return isNativeTokenAddress(address);
}

/** Normalize a wallet TokenBalance list into AI holdings, dropping empties. */
export function toAiHoldings(tokens: TokenBalance[], chain: Chain): AiTokenHolding[] {
  return tokens
    .filter((t) => t.amount > 0)
    .map((t) => {
      const isNative = isNativeFor(chain, t.contractAddress);
      return {
        chain,
        symbol: t.symbol,
        name: t.name,
        address: isNative ? undefined : t.contractAddress,
        decimals: t.decimals ?? (chain === "SOL" ? 9 : 18),
        amount: t.amount,
        usdValue: t.usdValue,
        pricePerToken: t.pricePerToken ?? 0,
        isNative,
      };
    })
    // Richest first, so an ambiguous symbol resolves to the meaningful holding.
    .sort((a, b) => b.usdValue - a.usdValue);
}

/**
 * Resolve what the user called a token to something they hold.
 * Accepts a symbol ("usdc"), a name ("USD Coin"), or a contract address.
 */
export function findHolding(
  holdings: AiTokenHolding[],
  query: string | undefined,
  chain?: Chain,
): AiTokenHolding | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  const pool = chain ? holdings.filter((h) => h.chain === chain) : holdings;

  return (
    pool.find((h) => h.address?.toLowerCase() === q) ??
    pool.find((h) => h.symbol.toLowerCase() === q) ??
    pool.find((h) => h.name.toLowerCase() === q) ??
    pool.find((h) => h.symbol.toLowerCase().replace(/\s+/g, "") === q.replace(/\s+/g, ""))
  );
}

/** Compact vocabulary handed to the parser so it names only real holdings. */
export function holdingsVocabulary(holdings: AiTokenHolding[]): string[] {
  return Array.from(
    new Set(holdings.map((h) => `${h.symbol} (${h.chain})`)),
  ).slice(0, 40);
}

/**
 * Human-readable token amount: precision where it matters (dust) without
 * dragging trailing zeros through million-unit memecoin balances.
 */
export function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const maximumFractionDigits = amount >= 1000 ? 2 : amount >= 1 ? 4 : 6;
  return amount.toLocaleString("en-US", { maximumFractionDigits });
}

/**
 * One-line-per-token summary for balance answers.
 * `includeChain` is off when the caller already groups by chain.
 */
export function formatHoldingLine(h: AiTokenHolding, includeChain = true): string {
  const usd = h.usdValue > 0 ? ` (~$${h.usdValue.toFixed(2)})` : "";
  const where = includeChain ? ` on ${h.chain}` : "";
  return `${formatTokenAmount(h.amount)} ${h.symbol}${where}${usd}`;
}
