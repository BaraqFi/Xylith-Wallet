"use client";

import { useApp } from "../app/AppContext";
import { manualWalletState, WalletTransaction } from "../wallet/data";
import { TokenLogo } from "../wallet/TokenLogo";
import { ChainLogo } from "../wallet/ChainLogo";

export function TransactionReceipt() {
  const { setCurrentView, selectedTransactionId } = useApp();

  const transaction = manualWalletState.transactions.find(
    (tx) => tx.id === selectedTransactionId
  ) as WalletTransaction | undefined;

  if (!transaction) {
    return (
      <div className="wallet-card p-8">
        <p className="text-[color:var(--color-depth)]/60">Transaction not found</p>
        <button
          onClick={() => setCurrentView("history")}
          className="mt-4 rounded-xl bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to History
        </button>
      </div>
    );
  }

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Transaction Receipt
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-depth)]/60">
            Detailed transaction information
          </p>
        </div>
        <button
          onClick={() => setCurrentView("history")}
          className="rounded-xl border border-[color:var(--color-depth)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
        >
          Back
        </button>
      </div>

      <div className="wallet-card space-y-6 p-8">
        <div className="flex items-center justify-between border-b border-[color:var(--color-depth)]/10 pb-4">
          <div>
            <p className="text-sm text-[color:var(--color-depth)]/60">Status</p>
            <p
              className={`mt-1 text-lg font-semibold ${transaction.status === "confirmed"
                ? "text-green-600"
                : transaction.status === "pending"
                  ? "text-yellow-600"
                  : "text-red-600"
                }`}
            >
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[color:var(--color-depth)]/60">Type</p>
            <p className="mt-1 text-lg font-semibold">{transaction.action}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Token</p>
            <div className="mt-1 flex items-center gap-2">
              <TokenLogo symbol={transaction.tokenSymbol} name={transaction.token} />
              <p className="font-semibold">{transaction.token}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Amount</p>
            <p className="mt-1 font-semibold">{transaction.amountLabel}</p>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Network</p>
            <div className="mt-1 flex items-center gap-2">
              {transaction.evmChain && (
                <ChainLogo chain={transaction.evmChain} />
              )}
              {transaction.chain === "Solana" && <ChainLogo chain="solana" />}
              <p className="font-semibold">
                {transaction.evmChain
                  ? transaction.evmChain.charAt(0).toUpperCase() +
                  transaction.evmChain.slice(1)
                  : transaction.chain}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Timestamp</p>
            <p className="mt-1 font-semibold">
              {new Date(transaction.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
          <p className="text-sm font-semibold text-[color:var(--color-depth)]">Transaction Hash</p>
          <div className="flex items-center justify-between rounded-xl bg-[color:var(--color-depth)]/5 p-3">
            <p className="break-all font-mono text-sm">{transaction.txHash}</p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(transaction.txHash);
              }}
              className="ml-2 rounded-lg border border-[color:var(--color-depth)]/10 px-3 py-1 text-xs font-semibold transition hover:bg-[color:var(--color-depth)]/10"
            >
              Copy
            </button>
          </div>
        </div>

        {transaction.blockHash && (
          <div className="space-y-4 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm font-semibold text-[color:var(--color-depth)]">Block Hash</p>
            <div className="flex items-center justify-between rounded-xl bg-[color:var(--color-depth)]/5 p-3">
              <p className="break-all font-mono text-sm">{transaction.blockHash}</p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(transaction.blockHash!);
                }}
                className="ml-2 rounded-lg border border-[color:var(--color-depth)]/10 px-3 py-1 text-xs font-semibold transition hover:bg-[color:var(--color-depth)]/10"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {transaction.blockNumber && (
            <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">Block Number</p>
              <p className="mt-1 font-semibold">{transaction.blockNumber.toLocaleString()}</p>
            </div>
          )}

          {transaction.gasUsed && (
            <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">Gas Used</p>
              <p className="mt-1 font-semibold">{transaction.gasUsed}</p>
            </div>
          )}

          {transaction.gasPrice && (
            <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">Gas Price</p>
              <p className="mt-1 font-semibold">
                {transaction.gasPrice} {transaction.chain === "EVM" ? "Gwei" : "lamports"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
          <p className="text-sm font-semibold text-[color:var(--color-depth)]">Addresses</p>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-[color:var(--color-depth)]/60">From</p>
              <div className="flex items-center justify-between rounded-xl bg-[color:var(--color-depth)]/5 p-3">
                <p className="break-all font-mono text-sm">{formatAddress(transaction.fromAddress)}</p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(transaction.fromAddress);
                  }}
                  className="ml-2 rounded-lg border border-[color:var(--color-depth)]/10 px-3 py-1 text-xs font-semibold transition hover:bg-[color:var(--color-depth)]/10"
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-[color:var(--color-depth)]/60">To</p>
              <div className="flex items-center justify-between rounded-xl bg-[color:var(--color-depth)]/5 p-3">
                <p className="break-all font-mono text-sm">{formatAddress(transaction.toAddress)}</p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(transaction.toAddress);
                  }}
                  className="ml-2 rounded-lg border border-[color:var(--color-depth)]/10 px-3 py-1 text-xs font-semibold transition hover:bg-[color:var(--color-depth)]/10"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

