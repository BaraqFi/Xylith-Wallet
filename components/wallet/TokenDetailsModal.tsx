"use client";

import { useState, useMemo } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance } from "./data";
import { ChainLogo, TokenLogo } from "./ManualWallet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, Send, ArrowRightLeft } from "lucide-react";

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
      await navigator.clipboard.writeText(token.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
            </div>
          </div>

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
              Value (30d)
            </h3>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

