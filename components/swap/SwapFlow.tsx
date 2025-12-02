"use client";

import { useState } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, TokenBalance } from "../wallet/data";
import { ChainLogo, TokenLogo } from "../wallet/ManualWallet";
import { TokenSelectModal } from "../wallet/TokenSelectModal";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  X,
  Loader2,
  ArrowLeft,
  ArrowUpDown,
  Settings,
} from "lucide-react";

type SwapStep = "form" | "confirm" | "loading" | "success" | "error";

function SlippageSettings({
  slippage,
  onSlippageChange,
  onClose,
}: {
  slippage: number;
  onSlippageChange: (value: number) => void;
  onClose: () => void;
}) {
  const [customSlippage, setCustomSlippage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [slippageError, setSlippageError] = useState("");

  const defaultSlippages = [0.1, 0.5, 1.0];
  const maxSlippage = 50; // Maximum slippage tolerance in percentage

  const handleDefaultSelect = (value: number) => {
    onSlippageChange(value);
    setUseCustom(false);
    setCustomSlippage("");
    setSlippageError("");
  };

  const handleCustomChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (value === "" || isNaN(numValue)) {
      setSlippageError("");
      return;
    }
    if (numValue < 0) {
      setSlippageError("Slippage cannot be negative");
      return;
    }
    if (numValue > maxSlippage) {
      setSlippageError(`Slippage cannot exceed ${maxSlippage}%`);
      return;
    }
    setSlippageError("");
    onSlippageChange(numValue);
    setUseCustom(true);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Slippage Tolerance</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex gap-2">
          {defaultSlippages.map((value) => (
            <Button
              key={value}
              variant={!useCustom && slippage === value ? "default" : "outline"}
              onClick={() => handleDefaultSelect(value)}
              className="flex-1"
            >
              {value}%
            </Button>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            Custom
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={customSlippage}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="0.0"
              step="0.1"
              min="0"
              max={maxSlippage}
              className="flex-1"
            />
            <span className="text-sm text-[color:var(--color-depth)]/60">%</span>
          </div>
          {slippageError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{slippageError}</p>
          )}
        </div>
        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </DialogContent>
  );
}

export function SwapFlow() {
  const { setCurrentView, preselectedToken, setPreselectedToken, slippage, setSlippage } = useApp();
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
  const [showFromTokenModal, setShowFromTokenModal] = useState(false);
  const [showToTokenModal, setShowToTokenModal] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [percentage, setPercentage] = useState(0);

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
    // Reset percentage when swapping
    if (toToken) {
      const newPercentage = newAmount && toToken.amount > 0
        ? (parseFloat(newAmount) / toToken.amount) * 100
        : 0;
      setPercentage(Math.min(100, Math.max(0, newPercentage)));
    } else {
      setPercentage(0);
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Update percentage based on amount
    if (fromToken && value && parseFloat(value) > 0) {
      const newPercentage = (parseFloat(value) / fromToken.amount) * 100;
      setPercentage(Math.min(100, Math.max(0, Math.round(newPercentage))));
    } else {
      setPercentage(0);
    }

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

  const handlePercentageChange = (value: number) => {
    setPercentage(value);
    if (fromToken && value > 0) {
      const newAmount = (fromToken.amount * value) / 100;
      setAmount(newAmount.toFixed(6));
      
      if (toToken && fromToken.pricePerToken && toToken.pricePerToken) {
        const fromValue = newAmount * fromToken.pricePerToken;
        const estimated = fromValue / toToken.pricePerToken;
        setEstimatedAmount(estimated.toFixed(6));
      }
    } else {
      setAmount("");
      setEstimatedAmount("");
    }
  };

  const handleFromTokenSelect = (token: TokenBalance) => {
    setFromToken(token);
    const chainKey = token.evmChain
      ? `${token.chain}-${token.evmChain}`
      : token.chain;
    setFromTokenChain(chainKey);
    setAmount("");
    setEstimatedAmount("");
    setPercentage(0);
    setError("");
    setPreselectedToken(null);
  };

  const handleToTokenSelect = (token: TokenBalance) => {
    setToToken(token);
    const chainKey = token.evmChain
      ? `${token.chain}-${token.evmChain}`
      : token.chain;
    setToTokenChain(chainKey);
    setEstimatedAmount("");
    setError("");
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
      // Recalculate amount and percentage if amount is set
      if (amount && parseFloat(amount) > 0) {
        const newPercentage = (parseFloat(amount) / tokenOnChain.amount) * 100;
        setPercentage(Math.min(100, Math.max(0, Math.round(newPercentage))));
      }
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
    setPercentage(0);
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
      <div className="flex items-center gap-2">
        {title === "Swap" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSlippageSettings(true)}
            className="h-8 w-8"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="h-6 w-6" />
        </Button>
      </div>
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
                size="sm"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm">{fromToken!.name}</p>
                <p className="text-xs text-[color:var(--color-depth)]/60">
                  {getChainLabel(fromToken!)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">
                  {amount} {fromToken!.symbol}
                </p>
                <p className="text-xs text-[color:var(--color-depth)]/60">
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
                size="sm"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm">{toToken!.name}</p>
                <p className="text-xs text-[color:var(--color-depth)]/60">
                  {getChainLabel(toToken!)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">
                  {estimatedAmount} {toToken!.symbol}
                </p>
                <p className="text-xs text-[color:var(--color-depth)]/60">
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
              {
                label: "Slippage Tolerance",
                value: `${slippage}%`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {label}
                </p>
                <p className="font-semibold text-sm">{value}</p>
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
        {/* From Section */}
        <div className="rounded-xl border border-[color:var(--color-border)] p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[color:var(--color-depth)]/60">From</span>
            {fromToken && (
              <span className="text-sm text-[color:var(--color-depth)]/60">
                Balance: {fromToken.amount.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowFromTokenModal(true)}
              className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 hover:bg-[color:var(--color-depth)]/5 transition flex-1 justify-between"
            >
              <div className="flex items-center gap-2">
                {fromToken ? (
                  <>
                    <TokenLogo symbol={fromToken.symbol} name={fromToken.name} size="sm" />
                    <span className="font-semibold text-sm">{fromToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-sm text-[color:var(--color-depth)]/60">Select Token</span>
                )}
              </div>
              <svg className="h-4 w-4 text-[color:var(--color-depth)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-right text-sm"
            />
          </div>

          {/* Percentage Slider */}
          {fromToken && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[color:var(--color-depth)]/60">
                <span>0%</span>
                <span className="font-semibold">{percentage}%</span>
                <span>100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                className="w-full h-2 bg-[color:var(--color-depth)]/10 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #62d7dd 0%, #62d7dd ${percentage}%, rgba(112, 111, 110, 0.1) ${percentage}%, rgba(112, 111, 110, 0.1) 100%)`
                }}
              />
            </div>
          )}

          {/* Chain Selector for Multi-chain tokens */}
          {fromToken && fromTokenChains.length > 1 && (
            <Select
              onValueChange={handleFromChainSelect}
              value={
                fromToken.evmChain
                  ? `${fromToken.chain}-${fromToken.evmChain}`
                  : fromToken.chain
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Chain" />
              </SelectTrigger>
              <SelectContent>
                {fromTokenChains.map((token) => {
                  const chainKey = token.evmChain
                    ? `${token.chain}-${token.evmChain}`
                    : token.chain;
                  const chainLabel =
                    token.evmChain
                      ? token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)
                      : "Solana";
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

        {/* Swap Button */}
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

        {/* To Section */}
        <div className="rounded-xl border border-[color:var(--color-border)] p-4 space-y-4">
          <span className="text-sm text-[color:var(--color-depth)]/60">To (estimated)</span>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowToTokenModal(true)}
              className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 hover:bg-[color:var(--color-depth)]/5 transition flex-1 justify-between"
            >
              <div className="flex items-center gap-2">
                {toToken ? (
                  <>
                    <TokenLogo symbol={toToken.symbol} name={toToken.name} size="sm" />
                    <span className="font-semibold text-sm">{toToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-sm text-[color:var(--color-depth)]/60">Select Token</span>
                )}
              </div>
              <svg className="h-4 w-4 text-[color:var(--color-depth)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Input
              type="number"
              value={estimatedAmount}
              placeholder="0.00"
              className="flex-1 text-right text-sm"
              readOnly
            />
          </div>

          {/* Chain Selector for Multi-chain tokens */}
          {toToken && toTokenChains.length > 1 && (
            <Select
              onValueChange={handleToChainSelect}
              value={
                toToken.evmChain
                  ? `${toToken.chain}-${toToken.evmChain}`
                  : toToken.chain
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Chain" />
              </SelectTrigger>
              <SelectContent>
                {toTokenChains.map((token) => {
                  const chainKey = token.evmChain
                    ? `${token.chain}-${token.evmChain}`
                    : token.chain;
                  const chainLabel =
                    token.evmChain
                      ? token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)
                      : "Solana";
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

      {/* Token Select Modals */}
      {showFromTokenModal && (
        <TokenSelectModal
          tokens={manualWalletState.tokens}
          onSelect={handleFromTokenSelect}
          onClose={() => setShowFromTokenModal(false)}
          excludeSymbol={toToken?.symbol}
        />
      )}

      {showToTokenModal && (
        <TokenSelectModal
          tokens={manualWalletState.tokens}
          onSelect={handleToTokenSelect}
          onClose={() => setShowToTokenModal(false)}
          excludeSymbol={fromToken?.symbol}
        />
      )}

      {/* Slippage Settings Dialog */}
      <Dialog open={showSlippageSettings} onOpenChange={setShowSlippageSettings}>
        <SlippageSettings
          slippage={slippage}
          onSlippageChange={setSlippage}
          onClose={() => setShowSlippageSettings(false)}
        />
      </Dialog>
    </div>
  );
}
