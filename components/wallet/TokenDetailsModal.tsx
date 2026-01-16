"use client";

import { useState, useMemo } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance } from "./data";
import { ChainLogo } from "./ChainLogo";
import { TokenLogo } from "./ManualWallet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, Send, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useTokenAnalytics } from "@/hooks/useTokenAnalytics";

interface TokenDetailsModalProps {
  token: TokenBalance;
  allTokens: TokenBalance[];
  onClose: () => void;
}

export function TokenDetailsModal({
  token,
  allTokens,
  onClose,
}: TokenDetailsModalProps) {
  const { setCurrentView, setPreselectedToken } = useApp();
  const [copied, setCopied] = useState(false);
  
  // Fetch token analytics
  const { analytics, isLoading: analyticsLoading } = useTokenAnalytics(
    token.symbol,
    token.evmChain || "ethereum",
    token.contractAddress,
    !!token.evmChain // Only fetch for EVM tokens
  );

  const tokenInstances = useMemo(
    () =>
      allTokens.filter(
        (t) => t.symbol === token.symbol && t.name === token.name
      ),
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
      try {
        await navigator.clipboard.writeText(token.contractAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Optionally show error toast to user
      }
    }
  };

  const valueHistory = useMemo(() => {
    const baseTimestamp = 1704067200000;
    const seed =
      (token.symbol.charCodeAt(0) || 0) + (token.symbol.charCodeAt(1) || 0);
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <TokenLogo symbol={token.symbol} name={token.name} />
            <div>
              <DialogTitle className="text-2xl">{token.name}</DialogTitle>
              <p className="text-sm text-[color:var(--color-depth)]/60">
                {token.symbol}
              </p>
            </div>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-6 p-1 pr-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">
                Total Amount
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {totalAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                {token.symbol}
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <p className="text-sm text-[color:var(--color-depth)]/60">
                Total Value
              </p>
              <p className="mt-1 text-2xl font-semibold">
                ${totalValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
              {analytics && analytics.priceChange24h !== undefined && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  {analytics.priceChange24h >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={
                      analytics.priceChange24h >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {analytics.priceChange24h >= 0 ? "+" : ""}
                    {analytics.priceChange24h.toFixed(2)}%
                  </span>
                  <span className="text-[color:var(--color-depth)]/60">
                    (24h)
                  </span>
                </div>
              )}
            </div>
          </div>

          {analytics && (
            <div className="grid gap-4 md:grid-cols-3">
              {analytics.currentPriceUsd !== undefined && (
                <div className="rounded-lg border border-[color:var(--color-border)] p-4">
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    Current Price
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    ${analytics.currentPriceUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </p>
                </div>
              )}
              {analytics.marketCap !== undefined && (
                <div className="rounded-lg border border-[color:var(--color-border)] p-4">
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    Market Cap
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    ${(analytics.marketCap / 1e9).toFixed(2)}B
                  </p>
                </div>
              )}
              {analytics.volume24h !== undefined && (
                <div className="rounded-lg border border-[color:var(--color-border)] p-4">
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    24h Volume
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    ${(analytics.volume24h / 1e6).toFixed(2)}M
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setPreselectedToken(token);
                onClose();
                setCurrentView("send");
              }}
              className="flex-1"
            >
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPreselectedToken(token);
                onClose();
                setCurrentView("swap");
              }}
              className="flex-1"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Swap
            </Button>
          </div>

          {tokenInstances.length > 1 && (
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <h3 className="mb-4 text-sm font-semibold text-[color:var(--color-depth)]">
                Holdings by Chain
              </h3>
              <div className="space-y-3">
                {tokenInstances.map((instance) => (
                  <div
                    key={`${instance.symbol}-${instance.chain}${instance.evmChain ? `-${instance.evmChain}` : ""}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <ChainLogo
                        chain={instance.evmChain || "solana"}
                      />
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
                      ${instance.usdValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {token.contractAddress && (
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[color:var(--color-depth)]">
                  Contract Address
                </h3>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="break-all font-mono text-xs">
                {token.contractAddress}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-[color:var(--color-border)] p-4">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--color-depth)]">
              Price History (7d)
            </h3>
            {analyticsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  Loading price data...
                </p>
              </div>
            ) : analytics?.sparkline && analytics.sparkline.length > 0 ? (
              <div className="h-32 w-full">
                <svg viewBox="0 0 300 120" className="h-full w-full">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[color:var(--color-accent)]"
                    points={analytics.sparkline
                      .map((price, i) => {
                        const minPrice = Math.min(...analytics.sparkline!);
                        const maxPrice = Math.max(...analytics.sparkline!);
                        const priceRange = maxPrice - minPrice || 1;
                        return `${(i / (analytics.sparkline!.length - 1)) * 280 + 10},${
                          110 - ((price - minPrice) / priceRange) * 100
                        }`;
                      })
                      .join(" ")}
                  />
                </svg>
              </div>
            ) : (
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
                          `${(i / (valueHistory.length - 1)) * 280 + 10},${
                            110 - ((v.value - minValue) / range) * 100
                          }`
                      )
                      .join(" ")}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

