/**
 * Transaction History Service
 * 
 * Provides transaction history from multiple sources:
 * 1. Alchemy (primary - more reliable)
 * 2. 1inch History API (fallback - may require premium tier)
 */

import { Address, EVMChain } from "@/components/wallet/data";

export interface TransactionHistoryItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset?: string;
  category: string;
  timestamp: number;
  blockNum: string;
}

/**
 * Get transaction history from Alchemy
 * Alchemy's getAssetTransfers API is more reliable than 1inch History API
 */
export async function getTransactionHistoryFromAlchemy(
  address: Address,
  chain: EVMChain,
  limit: number = 20
): Promise<TransactionHistoryItem[]> {
  // Use server-side API route to prevent API key exposure

  try {
    // Use server-side API route
    const response = await fetch("/api/alchemy/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            fromAddress: address,
            toAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"],
            withMetadata: true,
            excludeZeroValue: false,
            maxCount: `0x${limit.toString(16)}`, // Convert to hex
            order: "desc",
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }
    const transfers = result.result?.transfers || [];
    
    return transfers.map((transfer: any) => ({
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      value: transfer.value || "0",
      asset: transfer.asset,
      category: transfer.category,
      timestamp: transfer.metadata?.blockTimestamp 
        ? new Date(transfer.metadata.blockTimestamp).getTime()
        : Date.now(),
      blockNum: transfer.blockNum || "0x0",
    }));
  } catch (error) {
    console.error("Error fetching transaction history from Alchemy:", error);
    throw error;
  }
}

/**
 * Get transaction history - tries Alchemy first, falls back to 1inch if needed
 */
export async function getTransactionHistory(
  address: Address,
  chain: EVMChain,
  limit: number = 20
): Promise<TransactionHistoryItem[]> {
  // Always try Alchemy via server-side API route
  try {
    return await getTransactionHistoryFromAlchemy(address, chain, limit);
  } catch (error) {
    console.warn("Transaction history unavailable:", error);
    return [];
  }
}

