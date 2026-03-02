import { TokenBalance } from "./data";

export interface GroupedToken {
  symbol: string;
  name: string;
  logo: string;
  totalUsdValue: number;
  chains: TokenBalance[];
}

/**
 * Shortens an address to show first 6 and last 4 characters for "0x" addresses,
 * or first 4 and last 4 characters for non-"0x" addresses
 * @param address - The full address
 * @returns Shortened address (e.g., "0x12...5678" or "12ab...5678")
 */
export function shortenAddress(address: string): string {
  if (!address) return address;
  if (address.startsWith("0x")) {
    // For "0x" addresses: need at least 11 chars (0x + 4 front + 1 middle + 4 back)
    if (address.length < 11) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  // For non-"0x" addresses: need at least 9 chars (4 front + 1 middle + 4 back)
  if (address.length < 9) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Gets the chain name for display
 * @param chain - The chain identifier
 * @returns Display name
 */
export function getChainDisplayName(chain: string): string {
  const chainMap: Record<string, string> = {
    ethereum: "Ethereum",
    bsc: "BSC",
    base: "Base",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    polygon: "Polygon",
    solana: "Solana",
  };
  return chainMap[chain.toLowerCase()] || chain;
}

/**
 * Groups an array of tokens by their symbol.
 * @param tokens - The flat array of TokenBalance objects.
 * @returns An array of GroupedToken objects.
 */
export function groupTokensBySymbol(tokens: TokenBalance[]): GroupedToken[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const grouped = tokens.reduce((acc, token) => {
    const key = token.symbol;

    if (!acc[key]) {
      acc[key] = {
        symbol: token.symbol,
        name: token.name,
        logo: token.logo || "",
        totalUsdValue: 0,
        chains: [],
      };
    }

    const group = acc[key];

    // Use a composite instance key so we don't double-count the same
    // token instance (same chain / evmChain / contractAddress).
    const instanceKeyParts = [
      token.chain,
      token.evmChain || "",
      (token.contractAddress || "native").toLowerCase(),
    ];
    const instanceKey = instanceKeyParts.join(":");

    const existingIndex = group.chains.findIndex((t) => {
      const existingParts = [
        t.chain,
        t.evmChain || "",
        (t.contractAddress || "native").toLowerCase(),
      ];
      return existingParts.join(":") === instanceKey;
    });

    if (existingIndex === -1) {
      // First time we see this instance – add it and include its value.
      group.totalUsdValue += token.usdValue;
      group.chains.push(token);
    } else {
      // Duplicate instance (e.g. the same ETH balance surfaced twice);
      // merge values instead of rendering a second row.
      const existing = group.chains[existingIndex];
      const merged: TokenBalance = {
        ...existing,
        amount: existing.amount + token.amount,
        usdValue: existing.usdValue + token.usdValue,
      };
      group.chains[existingIndex] = merged;
      group.totalUsdValue += token.usdValue;
    }

    // Update logo if current token has one and group doesn't
    if (token.logo && !group.logo) {
      group.logo = token.logo;
    }

    return acc;
  }, {} as Record<string, GroupedToken>);

  return Object.values(grouped).sort((a, b) => b.totalUsdValue - a.totalUsdValue);
}

