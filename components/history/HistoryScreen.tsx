"use client";

import { useApp } from "../app/AppContext";
import { WalletTransaction } from "../wallet/data";
import { shortenAddress } from "../wallet/utils";
import { TokenLogo } from "../wallet/ManualWallet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, ArrowRightLeft } from "lucide-react";
import { useMemo } from "react";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";

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
  unknown: <ArrowRightLeft className="h-5 w-5 text-gray-500" />,
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
  unknown: {
    text: "text-gray-500",
    bg: "bg-gray-500/10",
  },
};

export function HistoryScreen() {
  const { setCurrentView, setSelectedTransactionId, activeChain } = useApp();

  // Default to 'ethereum' for EVM history in this MVP. 
  // Ideally we would aggregate or have a network selector.
  const { transactions, isLoading, error } = useTransactionHistory(activeChain, 'ethereum');

  // Group transactions by day
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, WalletTransaction[]> = {};
    
    transactions.forEach((tx) => {
      const date = new Date(tx.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else {
        const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 7) {
          groupKey = "Last 7 days";
        } else if (daysDiff <= 30) {
          groupKey = "Last 30 days";
        } else {
          groupKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });
    
    return groups;
  }, [transactions]);

  const handleTransactionClick = (tx: WalletTransaction) => {
    setSelectedTransactionId(tx.id);
    setCurrentView("receipt");
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "Send":
        return "bg-red-500/10 text-red-500";
      case "Receive":
        return "bg-green-500/10 text-green-500";
      case "Swap":
        return "bg-blue-500/10 text-blue-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
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
        {isLoading ? (
          <div className="py-12 text-center text-[color:var(--color-depth)]/60">
            Loading history...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[color:var(--color-depth)]/60">
              No transactions found
            </p>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([groupKey, groupTxs]) => (
              <div key={groupKey}>
                <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-depth)]/60 uppercase tracking-wide">
                  {groupKey}
                </h3>
                <div className="divide-y divide-[color:var(--color-border)]">
                  {groupTxs.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => handleTransactionClick(tx)}
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[color:var(--color-depth)]/5"
                    >
                      <div className="flex items-center gap-4">
                        {directionIcons[tx.direction] ? (
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${directionColors[tx.direction].bg}`}>
                            {directionIcons[tx.direction]}
                          </div>
                        ) : (
                          <TokenLogo symbol={tx.tokenSymbol || "?"} name={tx.token || "Unknown"} />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{tx.action}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getActionBadgeColor(tx.action)}`}>
                              {tx.action}
                            </span>
                          </div>
                          <p className="text-sm text-[color:var(--color-depth)]/60">
                            {tx.tokenSymbol || tx.token} • {tx.timestampLabel}
                          </p>
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
                            className={`h-2 w-2 rounded-full ${statusColors[tx.status]?.dot || 'bg-gray-400'}`}
                          />
                          <p
                            className={`text-sm font-medium ${statusColors[tx.status]?.text || 'text-gray-500'}`}
                          >
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

