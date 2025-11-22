"use client";

import { useApp } from "../app/AppContext";
import { manualWalletState, WalletTransaction } from "./data";
import { shortenAddress } from "./utils";
import { TokenLogo } from "./ManualWallet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, ArrowRightLeft } from "lucide-react";

const statusColors: Record<
  WalletTransaction["status"],
  { dot: string; text: string; bg: string }
> = {
  confirmed: {
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  pending: {
    dot: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  failed: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
};

const directionIcons: Record<WalletTransaction["direction"], React.ReactNode> = {
  in: <ArrowDown className="h-5 w-5 text-green-500" />,
  out: <ArrowUp className="h-5 w-5 text-red-500" />,
  swap: <ArrowRightLeft className="h-5 w-5 text-blue-500" />,
};

const directionColors: Record<
  WalletTransaction["direction"],
  { text: string; bg: string }
> = {
  in: {
    text: "text-green-500",
    bg: "bg-green-500/10",
  },
  out: {
    text: "text-red-500",
    bg: "bg-red-500/10",
  },
  swap: {
    text: "text-blue-500",
    bg: "bg-blue-500/10",
  },
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
        <Button variant="outline" onClick={() => setCurrentView("wallet")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="wallet-card flex flex-col p-2 sm:p-4">
        {manualWalletState.transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[color:var(--color-depth)]/60">
              No transactions yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {manualWalletState.transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => handleTransactionClick(tx)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[color:var(--color-depth)]/5"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${directionColors[tx.direction].bg}`}>
                    {directionIcons[tx.direction]}
                  </div>
                  <div className="flex items-center gap-2">
                    {(tx.direction === "in" || tx.direction === "out") && (
                      <TokenLogo symbol={tx.tokenSymbol} name={tx.token} />
                    )}
                    <div>
                      <p className="font-semibold">{tx.action}</p>
                      <p className="text-sm text-[color:var(--color-depth)]/60">
                        {tx.token}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block text-center">
                  <p className="font-mono text-sm text-[color:var(--color-depth)]/80">
                    {shortenAddress(tx.counterparty)}
                  </p>
                  <p className="text-xs text-[color:var(--color-depth)]/50">
                    Counterparty
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{tx.amountLabel}</p>
                  <div className="flex items-center justify-end gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${statusColors[tx.status].dot}`}
                    />
                    <p
                      className={`text-sm font-medium ${statusColors[tx.status].text}`}
                    >
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

