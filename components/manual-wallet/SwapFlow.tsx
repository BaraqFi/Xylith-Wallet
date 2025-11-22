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
import {
  Check,
  X,
  Loader2,
  ArrowLeft,
  ArrowUpDown,
} from "lucide-react";

type SwapStep = "form" | "confirm" | "loading" | "success" | "error";

function TokenSelectCard({
  label,
  selectedToken,
  onTokenSelect,
  onChainSelect,
  amount,
  onAmountChange,
  isFrom,
}: {
  label: string;
  selectedToken: TokenBalance | null;
  onTokenSelect: (symbol: string) => void;
  onChainSelect: (chainKey: string) => void;
  amount?: string;
  onAmountChange?: (value: string) => void;
  isFrom?: boolean;
}) {
  const groupedTokens = manualWalletState.tokens.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);

  const tokenChains = selectedToken
    ? groupedTokens[selectedToken.symbol] || []
    : [];

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] p-4 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-[color:var(--color-depth)]/60">{label}</span>
        {isFrom && selectedToken && (
          <span className="text-sm text-[color:var(--color-depth)]/60">
            Balance: {selectedToken.amount.toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex gap-4">
        <Select onValueChange={onTokenSelect} value={selectedToken?.symbol}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Token" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(groupedTokens).map((symbol) => (
              <SelectItem key={symbol} value={symbol}>
                <div className="flex items-center gap-2">
                  <TokenLogo symbol={symbol} name={symbol} />
                  {symbol}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          placeholder="0.00"
          className="text-right"
          readOnly={!isFrom}
        />
      </div>
      {selectedToken && tokenChains.length > 1 && (
        <Select
          onValueChange={onChainSelect}
          value={
            selectedToken.evmChain
              ? `${selectedToken.chain}-${selectedToken.evmChain}`
              : selectedToken.chain
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Chain" />
          </SelectTrigger>
          <SelectContent>
            {tokenChains.map((token) => {
              const chainKey = token.evmChain
                ? `${token.chain}-${token.evmChain}`
                : token.chain;
              const chainLabel =
                token.evmChain?.charAt(0).toUpperCase() +
                  token.evmChain?.slice(1) || "Solana";
              return (
                <SelectItem key={chainKey} value={chainKey}>
                  <div className="flex items-center gap-2">
                    <ChainLogo chain={token.evmChain || "solana"} />
                    {chainLabel}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function SwapFlow() {
  const { setCurrentView, preselectedToken, setPreselectedToken } = useApp();
  const [step, setStep] = useState<SwapStep>("form");
  const [fromToken, setFromToken] = useState<TokenBalance | null>(
    preselectedToken
  );
  const [toToken, setToToken] = useState<TokenBalance | null>(null);
  const [fromTokenChain, setFromTokenChain] = useState<string | null>(() => {
    if (preselectedToken) {
      return preselectedToken.evmChain
        ? `${preselectedToken.chain}-${preselectedToken.evmChain}`
        : preselectedToken.chain;
    }
    return null;
  });
  const [toTokenChain, setToTokenChain] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [error, setError] = useState("");

  const groupedTokens = manualWalletState.tokens.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);

  const fromTokenChains = fromToken ? groupedTokens[fromToken.symbol] || [] : [];
  const toTokenChains = toToken ? groupedTokens[toToken.symbol] || [] : [];

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempChain = fromTokenChain;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromTokenChain(toTokenChain);
    setToTokenChain(tempChain);
    const newAmount = estimatedAmount;
    const newEstimatedAmount = amount;
    setAmount(newAmount);
    setEstimatedAmount(newEstimatedAmount);
    setError("");
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (
      fromToken &&
      toToken &&
      value &&
      parseFloat(value) > 0 &&
      fromToken.pricePerToken &&
      toToken.pricePerToken
    ) {
      const fromValue = parseFloat(value) * fromToken.pricePerToken;
      const estimated = fromValue / toToken.pricePerToken;
      setEstimatedAmount(estimated.toFixed(6));
    } else {
      setEstimatedAmount("");
    }
  };

  const handleFromTokenSelect = (symbol: string) => {
    const tokens = groupedTokens[symbol];
    if (tokens && tokens.length > 0) {
      const bestToken = tokens.reduce((best, current) =>
        current.usdValue > best.usdValue ? current : best
      );
      setFromToken(bestToken);
      const chainKey = bestToken.evmChain
        ? `${bestToken.chain}-${bestToken.evmChain}`
        : bestToken.chain;
      setFromTokenChain(chainKey);
      setAmount("");
      setEstimatedAmount("");
      setError("");
      setPreselectedToken(null);
    }
  };

  const handleToTokenSelect = (symbol: string) => {
    const tokens = groupedTokens[symbol];
    if (tokens && tokens.length > 0) {
      const bestToken = tokens.reduce((best, current) =>
        current.usdValue > best.usdValue ? current : best
      );
      setToToken(bestToken);
      const chainKey = bestToken.evmChain
        ? `${bestToken.chain}-${bestToken.evmChain}`
        : bestToken.chain;
      setToTokenChain(chainKey);
      setEstimatedAmount("");
      setError("");
    }
  };

  const handleFromChainSelect = (chainKey: string) => {
    if (!fromToken) return;
    const tokenOnChain = fromTokenChains.find((t) => {
      const key = t.evmChain ? `${t.chain}-${t.evmChain}` : t.chain;
      return key === chainKey;
    });
    if (tokenOnChain) {
      setFromToken(tokenOnChain);
      setFromTokenChain(chainKey);
      if (
        amount &&
        toToken &&
        tokenOnChain.pricePerToken &&
        toToken.pricePerToken
      ) {
        const fromValue = parseFloat(amount) * tokenOnChain.pricePerToken;
        const estimated = fromValue / toToken.pricePerToken;
        setEstimatedAmount(estimated.toFixed(6));
      }
    }
  };

  const handleToChainSelect = (chainKey: string) => {
    if (!toToken) return;
    const tokenOnChain = toTokenChains.find((t) => {
      const key = t.evmChain ? `${t.chain}-${t.evmChain}` : t.chain;
      return key === chainKey;
    });
    if (tokenOnChain) {
      setToToken(tokenOnChain);
      setToTokenChain(chainKey);
      if (
        amount &&
        fromToken &&
        fromToken.pricePerToken &&
        tokenOnChain.pricePerToken
      ) {
        const fromValue = parseFloat(amount) * fromToken.pricePerToken;
        const estimated = fromValue / tokenOnChain.pricePerToken;
        setEstimatedAmount(estimated.toFixed(6));
      }
    }
  };

  const handleNext = () => {
    if (!fromToken || !toToken) {
      setError("Please select both tokens");
      return;
    }
    if (
      fromToken.symbol === toToken.symbol &&
      fromTokenChain === toTokenChain
    ) {
      setError("Cannot swap the same token on the same chain");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) > fromToken.amount) {
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
    }, 3000);
  };

  const handleClose = () => {
    setCurrentView("wallet");
    setStep("form");
    setFromToken(null);
    setToToken(null);
    setFromTokenChain(null);
    setToTokenChain(null);
    setPreselectedToken(null);
    setAmount("");
    setEstimatedAmount("");
    setError("");
  };

  const getChainLabel = (token: TokenBalance) => {
    if (token.evmChain) {
      return (
        token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)
      );
    }
    return "Solana";
  };

  const isCrossChain =
    fromToken &&
    toToken &&
    (fromToken.chain !== toToken.chain ||
      (fromToken.evmChain &&
        toToken.evmChain &&
        fromToken.evmChain !== toToken.evmChain));

  const gasEstimate = isCrossChain ? "~$15-25" : "~$5-10";
  const timeEstimate = isCrossChain ? "5-15 min" : "1-3 min";

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
            Processing swap...
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60">
            {isCrossChain ? "Executing cross-chain swap" : "Executing swap"}
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="wallet-card p-8">
        {renderHeader("Swap Successful")}
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15">
            <Check className="h-8 w-8 text-[color:var(--color-accent)]" />
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Swap completed!
          </p>
          <div className="mt-4 w-full space-y-2 rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Swapped</p>
              <p className="font-semibold">
                {amount} {fromToken?.symbol} on {getChainLabel(fromToken!)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Received</p>
              <p className="font-semibold">
                {estimatedAmount} {toToken?.symbol} on {getChainLabel(toToken!)}
              </p>
            </div>
          </div>
          <Button onClick={handleClose} className="mt-4 w-full">
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="wallet-card p-8">
        {renderHeader("Swap Failed")}
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <X className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Swap could not be completed
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
    const fromValue =
      fromToken && amount && fromToken.pricePerToken
        ? parseFloat(amount) * fromToken.pricePerToken
        : 0;
    const toValue =
      toToken && estimatedAmount && toToken.pricePerToken
        ? parseFloat(estimatedAmount) * toToken.pricePerToken
        : 0;

    return (
      <div className="wallet-card p-8">
        {renderHeader("Confirm Swap")}
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--color-border)] p-4">
            <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">From</p>
            <div className="flex items-center gap-3">
              <TokenLogo
                symbol={fromToken!.symbol}
                name={fromToken!.name}
              />
              <div className="flex-1">
                <p className="font-semibold">{fromToken!.name}</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {getChainLabel(fromToken!)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {amount} {fromToken!.symbol}
                </p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  ≈ ${fromValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowUpDown className="h-6 w-6 text-[color:var(--color-depth)]/60" />
          </div>

          <div className="rounded-xl border border-[color:var(--color-border)] p-4">
            <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">To</p>
            <div className="flex items-center gap-3">
              <TokenLogo
                symbol={toToken!.symbol}
                name={toToken!.name}
              />
              <div className="flex-1">
                <p className="font-semibold">{toToken!.name}</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {getChainLabel(toToken!)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {estimatedAmount} {toToken!.symbol}
                </p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  ≈ ${toValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] p-4">
            {[
              {
                label: "Swap Type",
                value: isCrossChain ? "Cross-Chain" : "Same-Chain",
              },
              { label: "Estimated Gas", value: gasEstimate },
              { label: "Estimated Time", value: timeEstimate },
              {
                label: "Route",
                value: isCrossChain ? "Rubic/Jupiter" : "Uniswap/Curve",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {label}
                </p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              Confirm Swap
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-card p-6 md:p-8">
      {renderHeader("Swap")}
      <div className="space-y-4">
        <TokenSelectCard
          label="From"
          selectedToken={fromToken}
          onTokenSelect={handleFromTokenSelect}
          onChainSelect={handleFromChainSelect}
          amount={amount}
          onAmountChange={handleAmountChange}
          isFrom
        />

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapTokens}
            className="rounded-full"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <TokenSelectCard
          label="To (estimated)"
          selectedToken={toToken}
          onTokenSelect={handleToTokenSelect}
          onChainSelect={handleToChainSelect}
          amount={estimatedAmount}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <Button
          onClick={handleNext}
          disabled={!fromToken || !toToken || !amount}
          className="w-full"
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
