"use client";

import { useState } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, TokenBalance } from "./data";
import { ChainLogo, TokenLogo } from "./ManualWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Loader2, ArrowLeft } from "lucide-react";

type SendStep = "form" | "confirm" | "loading" | "success" | "error";

export function SendFlow() {
  const { setCurrentView, preselectedToken, setPreselectedToken } = useApp();
  const [step, setStep] = useState<SendStep>("form");
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(
    preselectedToken
  );
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const [selectedChainFilter, setSelectedChainFilter] = useState<
    "EVM" | "Solana" | "all"
  >("all");
  const [selectedTokenChain, setSelectedTokenChain] = useState<string | null>(
    () => {
      if (preselectedToken) {
        return preselectedToken.evmChain
          ? `${preselectedToken.chain}-${preselectedToken.evmChain}`
          : preselectedToken.chain;
      }
      return null;
    }
  );

  const availableTokens = manualWalletState.tokens.filter((t) => {
    if (selectedChainFilter === "all") return true;
    return t.chain === selectedChainFilter;
  });

  const groupedTokens = availableTokens.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(token);
    return acc;
  }, {} as Record<string, typeof availableTokens>);

  const selectedTokenChains = selectedToken
    ? groupedTokens[selectedToken.symbol] || []
    : [];

  const handleChainSelect = (chainKey: string) => {
    if (!selectedToken) return;
    const tokenOnChain = selectedTokenChains.find((t) => {
      const key = t.evmChain ? `${t.chain}-${t.evmChain}` : t.chain;
      return key === chainKey;
    });
    if (tokenOnChain) {
      setSelectedToken(tokenOnChain);
      setSelectedTokenChain(chainKey);
    }
  };

  const handleNext = () => {
    if (!selectedToken) {
      setError("Please select a token");
      return;
    }
    if (!recipient || recipient.length < 10) {
      setError("Please enter a valid recipient address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) > selectedToken.amount) {
      setError("Insufficient balance");
      return;
    }
    setError("");
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("loading");
    setTimeout(() => {
      if (Math.random() > 0.2) {
        setStep("success");
      } else {
        setStep("error");
      }
    }, 2000);
  };

  const handleClose = () => {
    setCurrentView("wallet");
    setStep("form");
    setSelectedToken(null);
    setPreselectedToken(null);
    setRecipient("");
    setAmount("");
    setError("");
  };

  const renderHeader = (title: string) => (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
        {title}
      </h2>
      <Button variant="ghost" size="icon" onClick={handleClose}>
        <X className="h-6 w-6" />
      </Button>
    </div>
  );

  if (step === "loading") {
    return (
      <div className="wallet-card p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="h-16 w-16 animate-spin text-[color:var(--color-accent)]" />
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Processing transaction...
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60">
            Please wait while we send your transaction
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="wallet-card p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15">
            <Check className="h-8 w-8 text-[color:var(--color-accent)]" />
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Transaction successful!
          </p>
          <p className="text-sm text-center text-[color:var(--color-depth)]/60">
            {amount} {selectedToken?.symbol} has been sent to{" "}
            {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
          <Button onClick={handleClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="wallet-card p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Transaction failed
          </p>
          <p className="text-sm text-center text-[color:var(--color-depth)]/60">
            The transaction could not be completed. Please try again.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setStep("form")}>
              Try Again
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="wallet-card p-8">
        {renderHeader("Confirm Transaction")}
        <div className="space-y-6">
          {[
            { label: "Token", value: selectedToken?.name },
            {
              label: "Amount",
              value: `${amount} ${selectedToken?.symbol}`,
            },
            { label: "Recipient", value: recipient, mono: true },
            { label: "Network", value: manualWalletState.activeChain },
          ].map(({ label, value, mono }) => (
            <div
              key={label}
              className="rounded-xl border border-[color:var(--color-depth)]/10 p-4"
            >
              <p className="text-sm text-[color:var(--color-depth)]/60">
                {label}
              </p>
              <p
                className={`mt-1 text-lg font-semibold break-all ${mono ? "font-mono text-sm" : ""}`}
              >
                {value}
              </p>
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              Confirm & Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-card p-6 md:p-8">
      {renderHeader("Send")}
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="block text-sm font-medium text-[color:var(--color-depth)]">
              Select Token
            </label>
            <div className="flex gap-1 rounded-full border border-[color:var(--color-border)] p-1">
              {(["all", "EVM", "Solana"] as const).map((chain) => (
                <Button
                  key={chain}
                  size="sm"
                  variant={selectedChainFilter === chain ? "secondary" : "ghost"}
                  onClick={() => setSelectedChainFilter(chain)}
                  className="rounded-full text-xs"
                >
                  {chain === "all" ? "All" : chain}
                </Button>
              ))}
            </div>
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto p-1">
            {Object.entries(groupedTokens).map(([symbol, tokens]) => {
              const totalAmount = tokens.reduce((sum, t) => sum + t.amount, 0);
              const totalValue = tokens.reduce((sum, t) => sum + t.usdValue, 0);
              const firstToken = tokens[0];

              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => {
                    const bestToken = tokens.reduce((best, current) =>
                      current.usdValue > best.usdValue ? current : best
                    );
                    setSelectedToken(bestToken);
                    const chainKey = bestToken.evmChain
                      ? `${bestToken.chain}-${bestToken.evmChain}`
                      : bestToken.chain;
                    setSelectedTokenChain(chainKey);
                    setError("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                    selectedToken?.symbol === symbol
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                      : "border-transparent hover:bg-[color:var(--color-depth)]/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TokenLogo
                      symbol={symbol}
                      name={firstToken.name}
                    />
                    <div>
                      <p className="font-semibold">{firstToken.name}</p>
                      <p className="text-sm text-[color:var(--color-depth)]/60">
                        {totalAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}{" "}
                        {symbol}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${totalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedToken && selectedTokenChains.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Select Chain
            </label>
            <Select
              value={selectedTokenChain || ""}
              onValueChange={handleChainSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {selectedTokenChains.map((token) => {
                  const chainKey = token.evmChain
                    ? `${token.chain}-${token.evmChain}`
                    : token.chain;
                  const chainLabel = token.evmChain
                    ? token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)
                    : "Solana";
                  return (
                    <SelectItem key={chainKey} value={chainKey}>
                      <div className="flex items-center gap-2">
                        <ChainLogo
                          chain={token.evmChain || "solana"}
                        />
                        <span>
                          {chainLabel} -{" "}
                          {token.amount.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          {token.symbol} ($
                          {token.usdValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                          )
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            Recipient Address
          </label>
          <Input
            type="text"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setError("");
            }}
            placeholder={
              selectedToken?.chain === "Solana"
                ? "Enter Solana address..."
                : "0x..."
            }
            className="font-mono"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            Amount
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder="0.00"
              step="any"
            />
            {selectedToken && (
              <Button
                variant="secondary"
                onClick={() => setAmount(selectedToken.amount.toString())}
              >
                Max
              </Button>
            )}
          </div>
          {selectedToken && amount && selectedToken.pricePerToken && (
            <p className="mt-2 text-sm text-[color:var(--color-depth)]/60">
              ≈ $
              {(
                parseFloat(amount) * selectedToken.pricePerToken
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button onClick={handleNext} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}

