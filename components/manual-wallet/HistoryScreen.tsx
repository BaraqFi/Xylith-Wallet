"use client";

import { useApp } from "../app/AppContext";
import { manualWalletState, WalletTransaction } from "./data";
import { shortenAddress } from "./utils";

const statusColors = {
  confirmed: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
  pending: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
  failed: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
};

const directionIcons = {
  in: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        d="M12 4v14m0 0 4-4m-4 4-4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  out: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        d="M12 20V6m0 0-4 4m4-4 4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        d="M7 10H4l3-3 3 3H7zm10 4h3l-3 3-3-3h3zM7 10h13M17 14H4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
};

export function HistoryScreen() {
  const { setCurrentView, setSelectedTransactionId } = useApp();

  const handleTransactionClick = (tx: WalletTransaction) => {
    setSelectedTransactionId(tx.id);
    setCurrentView("receipt");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Transaction History
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-depth)]/60">
            View all your on-chain transactions
          </p>
        </div>
        <button
          onClick={() => setCurrentView("wallet")}
          className="rounded-xl border border-[color:var(--color-depth)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
        >
          Back
        </button>
      </div>

      <div className="wallet-card flex flex-col gap-4 p-6">
        {manualWalletState.transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[color:var(--color-depth)]/60">No transactions yet</p>
          </div>
        ) : (
          manualWalletState.transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => handleTransactionClick(tx)}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--color-depth)]/10 p-4 text-left transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-depth)]/5"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    tx.direction === "in"
                      ? "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                      : tx.direction === "out"
                        ? "bg-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]"
                        : "bg-[color:var(--color-depth)]/5 text-[color:var(--color-depth)]"
                  }`}
                >
                  {directionIcons[tx.direction]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{tx.action}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[tx.status]}`}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--color-depth)]/60">{tx.token}</p>
                  <p className="mt-1 text-xs text-[color:var(--color-depth)]/50">
                    {shortenAddress(tx.counterparty)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{tx.amountLabel}</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">{tx.timestampLabel}</p>
                <p className="mt-1 text-xs text-[color:var(--color-depth)]/50">{tx.chain}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

