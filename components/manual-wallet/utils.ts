/**
 * Shortens an address to show first 5 and last 5 characters
 * @param address - The full address
 * @returns Shortened address (e.g., "0x1234...5678a")
 */
export function shortenAddress(address: string): string {
  if (!address || address.length <= 10) return address;
  if (address.startsWith("0x")) {
    return `${address.slice(0, 7)}...${address.slice(-5)}`;
  }
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
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

