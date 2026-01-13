import { Address, parseUnits, formatUnits, parseAbiItem, encodeFunctionData } from "viem";
import { createPublicClient, http, createWalletClient, custom } from "viem";
import { mainnet, arbitrum, optimism, polygon, base, bsc } from "viem/chains";
import { EVMChain, TokenBalance } from "@/components/wallet/data";
import { getAlchemyRpcUrl } from "./alchemyClient";
// Note: Alchemy RPC calls should go through /api/alchemy/rpc proxy
// This file uses public RPC for transaction building

// Map our internal chain IDs to Viem chains
const chainMap: Record<EVMChain, any> = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  optimism: optimism,
  polygon: polygon,
  base: base,
  bsc: bsc,
};

export interface TransactionDetails {
  to: Address;
  value: bigint;
  data?: `0x${string}`;
  gasEstimate?: bigint;
  gasPrice?: bigint;
  totalCost?: bigint;
}

export interface TransactionPreview {
  recipient: Address;
  amount: string;
  token: TokenBalance;
  chain: EVMChain;
  gasEstimate: string;
  gasPrice: string;
  totalCost: string;
  transactionData: TransactionDetails;
}

/**
 * Build a native token transfer transaction
 */
export async function buildNativeTransferTransaction(
  recipient: Address,
  amount: string,
  chain: EVMChain,
  fromAddress: Address
): Promise<TransactionDetails> {
  const targetChain = chainMap[chain];
  if (!targetChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  // Use public RPC - Alchemy calls go through server-side API routes
  const client = createPublicClient({
    chain: targetChain,
    transport: http(), // Use default public RPC
  });

  const value = parseUnits(amount, targetChain.nativeCurrency.decimals);

  // Estimate gas
  const gasEstimate = await client.estimateGas({
    account: fromAddress,
    to: recipient,
    value,
  });

  // Get gas price
  const gasPrice = await client.getGasPrice();

  const totalCost = gasEstimate * gasPrice + value;

  return {
    to: recipient,
    value,
    gasEstimate,
    gasPrice,
    totalCost,
  };
}

/**
 * Build an ERC20 token transfer transaction
 */
export async function buildERC20TransferTransaction(
  token: TokenBalance,
  recipient: Address,
  amount: string,
  chain: EVMChain,
  fromAddress: Address
): Promise<TransactionDetails> {
  if (!token.contractAddress) {
    throw new Error("Token contract address is required for ERC20 transfers");
  }

  const targetChain = chainMap[chain];
  if (!targetChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  // Use public RPC - Alchemy calls go through server-side API routes
  const client = createPublicClient({
    chain: targetChain,
    transport: http(), // Use default public RPC
  });

  const decimals = token.decimals || 18;
  const value = parseUnits(amount, decimals);

  // Build transfer function call
  const data = encodeFunctionData({
    abi: [
      parseAbiItem("function transfer(address to, uint256 amount) returns (bool)"),
    ],
    functionName: "transfer",
    args: [recipient, value],
  });

  // Estimate gas
  const gasEstimate = await client.estimateGas({
    account: fromAddress,
    to: token.contractAddress as Address,
    data,
  });

  // Get gas price
  const gasPrice = await client.getGasPrice();

  const totalCost = gasEstimate * gasPrice;

  return {
    to: token.contractAddress as Address,
    value: BigInt(0), // ERC20 transfers don't send native token
    data,
    gasEstimate,
    gasPrice,
    totalCost,
  };
}

/**
 * Simulate a transaction to check if it will succeed
 */
export async function simulateTransaction(
  transaction: TransactionDetails,
  chain: EVMChain,
  fromAddress: Address
): Promise<boolean> {
  try {
    const targetChain = chainMap[chain];
    if (!targetChain) {
      throw new Error(`Unsupported EVM chain: ${chain}`);
    }

    const rpcUrl = getAlchemyRpcUrl(chain);
    const client = createPublicClient({
      chain: targetChain,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    // Try to call the transaction (simulation)
    await client.call({
      account: fromAddress,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
    });

    return true;
  } catch (error) {
    console.error("Transaction simulation failed:", error);
    return false;
  }
}

/**
 * Create a transaction preview with formatted values
 */
export async function createTransactionPreview(
  token: TokenBalance,
  recipient: Address,
  amount: string,
  chain: EVMChain,
  fromAddress: Address
): Promise<TransactionPreview> {
  const isNative = 
    !token.contractAddress ||
    token.contractAddress === "0x0000000000000000000000000000000000000000";

  const transactionData = isNative
    ? await buildNativeTransferTransaction(recipient, amount, chain, fromAddress)
    : await buildERC20TransferTransaction(token, recipient, amount, chain, fromAddress);

  const targetChain = chainMap[chain];
  const gasEstimate = transactionData.gasEstimate || BigInt(0);
  const gasPrice = transactionData.gasPrice || BigInt(0);

  return {
    recipient,
    amount,
    token,
    chain,
    gasEstimate: formatUnits(gasEstimate, 0),
    gasPrice: formatUnits(gasPrice, targetChain.nativeCurrency.decimals),
    totalCost: transactionData.totalCost
      ? formatUnits(transactionData.totalCost, targetChain.nativeCurrency.decimals)
      : "0",
    transactionData,
  };
}


