"use client";

import { useState, useMemo } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance } from "./data";
import { ChainLogo } from "./ManualWallet";
import { shortenAddress } from "./utils";
import { manualWalletState } from "./data";

interface TokenDetailsModalProps {
  token: TokenBalance;
  allTokens: TokenBalance[];
  onClose: () => void;
}

export function TokenDetailsModal({ token, allTokens, onClose }: TokenDetailsModalProps) {
  const { setCurrentView, setPreselectedToken } = useApp();
  const [copied, setCopied] = useState(false);

  // Find all instances of this token across chains
  const tokenInstances = useMemo(
    () => allTokens.filter((t) => t.symbol === token.symbol && t.name === token.name),
    [allTokens, token.symbol, token.name]
  );

  const totalValue = useMemo(
    () => tokenInstances.reduce((sum, t) => sum + t.usdValue, 0),
    [tokenInstances]
  );
  const totalAmount = useMemo(
    () => tokenInstances.reduce((sum, t) => sum + t.amount, 0),
    [tokenInstances]
  );

  const handleCopy = async () => {
    if (token.contractAddress) {
      await navigator.clipboard.writeText(token.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate simple value history data (mock data for now)
  const valueHistory = useMemo(() => {
    const baseTimestamp = 1704067200000; // Fixed base timestamp
    const seed = (token.symbol.charCodeAt(0) || 0) + (token.symbol.charCodeAt(1) || 0);
    return Array.from({ length: 30 }, (_, i) => {
      const hash = (seed + i) % 100;
      const variation = 0.8 + (hash / 100) * 0.4;
      return {
        date: baseTimestamp + i * 24 * 60 * 60 * 1000,
        value: totalValue * variation,
      };
    });
  }, [token.symbol, totalValue]);

  const minValue = Math.min(...valueHistory.map((v) => v.value));
  const maxValue = Math.max(...valueHistory.map((v) => v.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4">
      <div className="wallet-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-xl text-[color:var(--color-accent)]">
              {token.symbol[0]}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
                {token.name}
              </h2>
              <p className="text-sm text-[color:var(--color-depth)]/60">{token.symbol}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">Total Amount</p>
              <p className="mt-1 text-2xl font-semibold">
                {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">Total Value</p>
              <p className="mt-1 text-2xl font-semibold">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {token.contractAddress && (
            <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[color:var(--color-depth)]">
                  Contract Address
                </p>
                <button
                  onClick={handleCopy}
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1 text-xs font-semibold transition hover:bg-[color:var(--color-depth)]/5"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="break-all font-mono text-sm">{token.contractAddress}</p>
            </div>
          )}

          {tokenInstances.length > 1 && (
            <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
              <p className="mb-4 text-sm font-semibold text-[color:var(--color-depth)]">
                Holdings by Chain
              </p>
              <div className="space-y-3">
                {tokenInstances.map((instance) => (
                  <div
                    key={`${instance.symbol}-${instance.chain}${instance.evmChain ? `-${instance.evmChain}` : ""}`}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] p-3"
                  >
                    <div className="flex items-center gap-3">
                      {instance.evmChain && <ChainLogo chain={instance.evmChain} />}
                      {instance.chain === "Solana" && <ChainLogo chain="solana" />}
                      <div>
                        <p className="font-semibold">
                          {instance.evmChain || instance.chain}
                        </p>
                        <p className="text-sm text-[color:var(--color-depth)]/60">
                          {instance.amount.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          {instance.symbol}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">
                      ${instance.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPreselectedToken(token);
                onClose();
                setCurrentView("send");
              }}
              className="flex-1 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Send
            </button>
            <button
              onClick={() => {
                setPreselectedToken(token);
                onClose();
                setCurrentView("swap");
              }}
              className="flex-1 rounded-xl border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-accent)] transition hover:bg-[color:var(--color-accent)]/20"
            >
              Swap
            </button>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
            <p className="mb-4 text-sm font-semibold text-[color:var(--color-depth)]">
              Value Over Time (Last 30 Days)
            </p>
            <div className="h-32 w-full">
              <svg viewBox="0 0 300 120" className="h-full w-full">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[color:var(--color-accent)]"
                  points={valueHistory
                    .map(
                      (v, i) =>
                        `${(i / (valueHistory.length - 1)) * 280 + 10},${110 - ((v.value - minValue) / range) * 100}`
                    )
                    .join(" ")}
                />
                <polyline
                  fill={`url(#gradient-${token.symbol})`}
                  stroke="none"
                  points={`${(0 / (valueHistory.length - 1)) * 280 + 10},110 ${valueHistory
                    .map(
                      (v, i) =>
                        `${(i / (valueHistory.length - 1)) * 280 + 10},${110 - ((v.value - minValue) / range) * 100}`
                    )
                    .join(" ")} ${((valueHistory.length - 1) / (valueHistory.length - 1)) * 280 + 10},110`}
                />
                <defs>
                  <linearGradient
                    id={`gradient-${token.symbol}`}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="currentColor"
                      className="text-[color:var(--color-accent)]"
                      stopOpacity="0.3"
                    />
                    <stop
                      offset="100%"
                      stopColor="currentColor"
                      className="text-[color:var(--color-accent)]"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
            <p className="mb-4 text-sm font-semibold text-[color:var(--color-depth)]">
              Recent Transactions
            </p>
            <div className="space-y-2">
              {(() => {
                const tokenTransactions = manualWalletState.transactions.filter(
                  (tx) => tx.tokenSymbol === token.symbol || tx.token.includes(token.symbol)
                );

                if (tokenTransactions.length === 0) {
                  return (
                    <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
                      No transactions for this token
                    </div>
                  );
                }

                return tokenTransactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold ${
                          tx.direction === "in"
                            ? "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                            : tx.direction === "out"
                              ? "bg-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]"
                              : "bg-[color:var(--color-depth)]/5 text-[color:var(--color-depth)]"
                        }`}
                      >
                        {tx.action}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{tx.token}</p>
                        <p className="text-xs text-[color:var(--color-depth)]/60">
                          {shortenAddress(tx.counterparty)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{tx.amountLabel}</p>
                      <p className="text-xs text-[color:var(--color-depth)]/60">
                        {tx.timestampLabel}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

