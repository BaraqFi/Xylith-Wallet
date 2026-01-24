import { Address } from "viem";
import { EVMChain, TokenBalance } from "@/components/wallet/data";

export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

export interface AlchemyTokenMetadata {
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
}

// Normalized shape for Moralis balances (used client-side)
export interface MoralisTokenBalance {
  contractAddress: string | null;
  tokenBalance: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
  usdValue?: number;
  pricePerToken?: number;
}

/**
 * Fetch all token balances for an address using Alchemy's getTokenBalances API
 * This is more efficient than individual RPC calls per token
 */
export async function getTokenBalancesFromAlchemy(
  address: Address,
  chain: EVMChain
): Promise<AlchemyTokenBalance[]> {
  try {
    const response = await fetch("/api/alchemy/token-balances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, chain }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.balances || [];
  } catch (error) {
    console.error("Error fetching token balances from Alchemy:", error);
    throw error;
  }
}

/**
 * Get token metadata (name, symbol, decimals) from Alchemy
 */
export async function getTokenMetadataFromAlchemy(
  contractAddress: Address,
  chain: EVMChain
): Promise<AlchemyTokenMetadata | null> {
  try {
    const response = await fetch("/api/alchemy/token-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contractAddress, chain }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.metadata || null;
  } catch (error) {
    console.error("Error fetching token metadata from Alchemy:", error);
    return null;
  }
}

/**
 * Get token balances from Moralis API (fallback/alternative to Alchemy)
 */
export async function getTokenBalancesFromMoralis(
  address: Address,
  chain: EVMChain
): Promise<MoralisTokenBalance[]> {
  try {
    const response = await fetch("/api/moralis/token-balances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, chain }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Moralis API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.balances || [];
  } catch (error) {
    console.error("Error fetching token balances from Moralis:", error);
    throw error;
  }
}

/**
 * Get native token balance (ETH, MATIC, etc.) from Alchemy
 */
export async function getNativeBalanceFromAlchemy(
  address: Address,
  chain: EVMChain
): Promise<string> {
  try {
    const response = await fetch("/api/alchemy/native-balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, chain }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.balance || "0x0";
  } catch (error) {
    console.error("Error fetching native balance from Alchemy:", error);
    throw error;
  }
}


