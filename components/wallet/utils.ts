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
        logo: token.logo || '',
        totalUsdValue: 0,
        chains: [],
      };
    }
    acc[key].totalUsdValue += token.usdValue;
    acc[key].chains.push(token);
    return acc;
  }, {} as Record<string, GroupedToken>);

  return Object.values(grouped).sort((a, b) => b.totalUsdValue - a.totalUsdValue);
}

