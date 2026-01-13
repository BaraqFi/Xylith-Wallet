import { Address, parseAbiItem } from "viem";
import { EVMChain } from "@/components/wallet/data";
import { getPublicRpcClient } from "./rpcConfig";
import { getTokenMetadataFromAlchemy } from "./tokenIndexer";

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

/**
 * Validate if an address is a valid contract address format
 */
export function isValidContractAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Fetch token metadata from contract address
 */
export async function fetchTokenMetadata(
  contractAddress: Address,
  chain: EVMChain
): Promise<TokenMetadata | null> {
  if (!isValidContractAddress(contractAddress)) {
    throw new Error("Invalid contract address format");
  }

  // Use centralized public RPC client
  const client = getPublicRpcClient(chain);

  try {
    // Try Alchemy first (faster and includes logo)
    const alchemyMetadata = await getTokenMetadataFromAlchemy(contractAddress, chain);
    if (alchemyMetadata && alchemyMetadata.name && alchemyMetadata.symbol) {
      return {
        name: alchemyMetadata.name,
        symbol: alchemyMetadata.symbol,
        decimals: alchemyMetadata.decimals || 18,
        logo: alchemyMetadata.logo,
      };
    }
  } catch (error) {
    console.warn("Alchemy metadata fetch failed, falling back to RPC:", error);
  }

  // Fallback to direct RPC calls
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: [parseAbiItem("function name() view returns (string)")],
        functionName: "name",
      }).catch(() => null),
      client.readContract({
        address: contractAddress,
        abi: [parseAbiItem("function symbol() view returns (string)")],
        functionName: "symbol",
      }).catch(() => null),
      client.readContract({
        address: contractAddress,
        abi: [parseAbiItem("function decimals() view returns (uint8)")],
        functionName: "decimals",
      }).catch(() => null),
    ]);

    if (!name || !symbol) {
      throw new Error("Contract does not implement ERC20 standard");
    }

    return {
      name: name as string,
      symbol: symbol as string,
      decimals: decimals ? Number(decimals) : 18,
    };
  } catch (error: any) {
    console.error("Error fetching token metadata:", error);
    throw new Error(
      error.message || "Failed to fetch token metadata. Please verify the contract address."
    );
  }
}

/**
 * Check if an address is a contract (not an EOA)
 */
export async function isContractAddress(
  address: Address,
  chain: EVMChain
): Promise<boolean> {
  try {
    // Use centralized public RPC client
    const client = getPublicRpcClient(chain);
    const code = await client.getBytecode({ address });
    return code !== undefined && code !== "0x";
  } catch (error) {
    console.error("Error checking if address is contract:", error);
    return false;
  }
}


