import { Address, parseUnits, formatUnits, parseAbiItem, encodeFunctionData } from "viem";
import { createWalletClient, custom } from "viem";
import { EVMChain, TokenBalance, Chain, isNativeTokenAddress } from "@/components/wallet/data";
import { getPublicRpcClient } from "./rpcConfig";
// Note: Alchemy RPC calls should go through /api/alchemy/rpc proxy
// This file uses centralized public RPC for transaction building

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
  chain: EVMChain | "Solana";
  gasEstimate: string;
  gasPrice: string;
  totalCost: string;
  transactionData: TransactionDetails;
}

/**
 * Build a native token transfer transaction
 */
/**
 * Effective price per gas unit.
 *
 * On EIP-1559 chains the legacy `eth_gasPrice` understates what a transaction
 * actually pays, so the total shown to the user came out low. Prefer
 * maxFeePerGas (base + priority) and fall back to gasPrice on chains or
 * providers that don't support the fee-history call.
 */
async function getEffectiveGasPrice(client: PublicClientLike): Promise<bigint> {
  try {
    const fees = await client.estimateFeesPerGas();
    if (fees?.maxFeePerGas) return fees.maxFeePerGas;
    if (fees?.gasPrice) return fees.gasPrice;
  } catch {
    // provider doesn't support 1559 fee estimation — fall through
  }
  return client.getGasPrice();
}

type PublicClientLike = ReturnType<typeof getPublicRpcClient>;

export async function buildNativeTransferTransaction(
  recipient: Address,
  amount: string,
  chain: EVMChain,
  fromAddress: Address
): Promise<TransactionDetails> {
  // Use centralized public RPC client
  const client = getPublicRpcClient(chain);
  const targetChain = client.chain;

  const value = parseUnits(amount, targetChain?.nativeCurrency?.decimals ?? 18);

  const [gasEstimate, gasPrice] = await Promise.all([
    client.estimateGas({ account: fromAddress, to: recipient, value }),
    getEffectiveGasPrice(client),
  ]);

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

  // Use centralized public RPC client
  const client = getPublicRpcClient(chain);
  const targetChain = client.chain;

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

  const [gasEstimate, gasPrice] = await Promise.all([
    client.estimateGas({
      account: fromAddress,
      to: token.contractAddress as Address,
      data,
    }),
    getEffectiveGasPrice(client),
  ]);

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
    // Use centralized public RPC client
    const client = getPublicRpcClient(chain);

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
  const isNative = isNativeTokenAddress(token.contractAddress);

  const transactionData = isNative
    ? await buildNativeTransferTransaction(recipient, amount, chain, fromAddress)
    : await buildERC20TransferTransaction(token, recipient, amount, chain, fromAddress);

  // Get chain info from RPC client
  const client = getPublicRpcClient(chain);
  const targetChain = client.chain;
  const gasEstimate = transactionData.gasEstimate || BigInt(0);
  const gasPrice = transactionData.gasPrice || BigInt(0);

  return {
    recipient,
    amount,
    token,
    chain,
    gasEstimate: formatUnits(gasEstimate, 0),
    gasPrice: formatUnits(gasPrice, targetChain?.nativeCurrency?.decimals ?? 18),
    totalCost: transactionData.totalCost
      ? formatUnits(transactionData.totalCost, targetChain?.nativeCurrency?.decimals ?? 18)
      : "0",
    transactionData,
  };
}


