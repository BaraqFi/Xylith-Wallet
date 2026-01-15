"use client";

import { useState, useEffect } from "react";
import { TransactionPreview } from "@/lib/services/transactionBuilder";
import { TokenBalance, EVMChain } from "@/components/wallet/data";
import { formatUnits, Address } from "viem";
import { ChainLogo } from "../wallet/ManualWallet";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface TransactionDetailsProps {
  preview: TransactionPreview;
  selectedToken: TokenBalance | null;
  insufficientBalance?: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export function TransactionDetails({
  preview,
  selectedToken,
  insufficientBalance = false,
  onEdit,
  onConfirm,
  isConfirming = false,
}: TransactionDetailsProps) {
  const { recipient, amount, token, chain, gasEstimate, gasPrice, totalCost } = preview;

  // Check if balance is actually insufficient
  const amountNum = parseFloat(amount);
  const balanceNum = selectedToken?.amount || 0;
  const isActuallyInsufficient = amountNum > balanceNum;

  // Check if recipient is a contract address
  const [isRecipientContract, setIsRecipientContract] = useState<boolean | null>(null);
  const [checkingContract, setCheckingContract] = useState(false);

  useEffect(() => {
    if (!recipient || !selectedToken?.evmChain) {
      setIsRecipientContract(null);
      return;
    }

    setCheckingContract(true);
    fetch("/api/security/recipient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: recipient,
        chain: selectedToken.evmChain,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsRecipientContract(data.isContract || false);
      })
      .catch(() => {
        setIsRecipientContract(null);
      })
      .finally(() => {
        setCheckingContract(false);
      });
  }, [recipient, selectedToken?.evmChain]);

  return (
    <div className="space-y-4">
      {/* Token and Amount */}
      <div className="rounded-xl border border-[color:var(--color-depth)]/10 p-4">
        <p className="text-sm text-[color:var(--color-depth)]/60 mb-1">Token</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold">{token.name}</p>
          {token.evmChain && <ChainLogo chain={token.evmChain} />}
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--color-depth)]/10 p-4">
        <p className="text-sm text-[color:var(--color-depth)]/60 mb-1">Amount</p>
        <p className="text-lg font-semibold">
          {amount} {token.symbol}
        </p>
      </div>

      {/* Recipient */}
      <div className="rounded-xl border border-[color:var(--color-depth)]/10 p-4">
        <p className="text-sm text-[color:var(--color-depth)]/60 mb-1">Recipient</p>
        <p className="text-sm font-mono break-all">{recipient}</p>
        {isRecipientContract && (
          <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                This is a contract address, not a regular wallet. Ensure you trust this contract and are sending to the correct address.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Network */}
      <div className="rounded-xl border border-[color:var(--color-depth)]/10 p-4">
        <p className="text-sm text-[color:var(--color-depth)]/60 mb-1">Network</p>
        <p className="text-lg font-semibold capitalize">{chain}</p>
      </div>

      {/* Insufficient Balance Warning */}
      {isActuallyInsufficient && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-900 mb-1">
                Insufficient Balance
              </p>
              <p className="text-sm text-orange-700">
                You're trying to send {amount} {token.symbol}, but you only have {balanceNum.toFixed(6)} {token.symbol} available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gas Information */}
      <div className="rounded-xl border border-[color:var(--color-depth)]/10 p-4 space-y-2">
        <p className="text-sm text-[color:var(--color-depth)]/60">Gas Information</p>
        <div className="flex justify-between text-sm">
          <span className="text-[color:var(--color-depth)]/70">Estimated Gas:</span>
          <span className="font-semibold">{gasEstimate}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[color:var(--color-depth)]/70">Gas Price:</span>
          <span className="font-semibold">{parseFloat(gasPrice).toFixed(9)} {chain === 'Solana' ? 'SOL' : (token.evmChain === 'bsc' ? 'BNB' : (token.evmChain === 'polygon' ? 'MATIC' : 'ETH'))}</span>
        </div>
        <div className="pt-2 border-t border-[color:var(--color-depth)]/10">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-[color:var(--color-depth)]">Total Cost:</span>
            <span className="text-sm font-semibold">{parseFloat(totalCost).toFixed(6)} {chain === 'Solana' ? 'SOL' : (token.evmChain === 'bsc' ? 'BNB' : (token.evmChain === 'polygon' ? 'MATIC' : 'ETH'))}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onEdit}
          disabled={isConfirming}
          className="flex-1 px-4 py-3 rounded-xl border border-[color:var(--color-depth)]/20 bg-transparent text-[color:var(--color-depth)] hover:bg-[color:var(--color-depth)]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Edit
        </button>
        <button
          onClick={onConfirm}
          disabled={isConfirming || isActuallyInsufficient}
          className="flex-1 px-4 py-3 rounded-xl bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {isConfirming ? "Confirming..." : isActuallyInsufficient ? "Insufficient Balance" : "Confirm & Sign"}
        </button>
      </div>
    </div>
  );
}


