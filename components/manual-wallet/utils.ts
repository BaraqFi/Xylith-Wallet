/**
 * Shortens an address to show first 4 and last 4 characters
 * @param address - The full address
 * @returns Shortened address (e.g., "0x12...5678")
 */
export function shortenAddress(address: string): string {
  if (!address || address.length <= 8) return address;
  if (address.startsWith("0x")) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
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

