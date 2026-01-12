import { useState } from "react";
import { Address } from "viem";
import { TokenBalance, EVMChain } from "@/components/wallet/data";
import {
  createTransactionPreview,
  TransactionPreview,
  simulateTransaction,
} from "@/lib/services/transactionBuilder";

export function useTransactionBuilder() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransactionPreview | null>(null);

  const buildTransaction = async (
    token: TokenBalance,
    recipient: Address,
    amount: string,
    chain: EVMChain,
    fromAddress: Address
  ) => {
    setIsBuilding(true);
    setError(null);
    setPreview(null);

    try {
      // Create transaction preview
      const transactionPreview = await createTransactionPreview(
        token,
        recipient,
        amount,
        chain,
        fromAddress
      );

      // Simulate transaction to check if it will succeed
      const willSucceed = await simulateTransaction(
        transactionPreview.transactionData,
        chain,
        fromAddress
      );

      if (!willSucceed) {
        throw new Error("Transaction simulation failed. Please check your balance and recipient address.");
      }

      setPreview(transactionPreview);
      return transactionPreview;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to build transaction";
      setError(errorMessage);
      throw err;
    } finally {
      setIsBuilding(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
  };

  return {
    buildTransaction,
    preview,
    isBuilding,
    error,
    clearPreview,
  };
}


