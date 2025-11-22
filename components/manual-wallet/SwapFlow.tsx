"use client";

import { useState } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, TokenBalance } from "./data";
import { ChainLogo } from "./ManualWallet";

type SwapStep = "form" | "confirm" | "loading" | "success" | "error";

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

  // Group tokens by symbol
  const groupedTokens = manualWalletState.tokens.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);

  // Get available chains for selected tokens
  const fromTokenChains = fromToken ? groupedTokens[fromToken.symbol] || [] : [];
  const toTokenChains = toToken ? groupedTokens[toToken.symbol] || [] : [];

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempChain = fromTokenChain;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromTokenChain(toTokenChain);
    setToTokenChain(tempChain);
    setAmount("");
    setEstimatedAmount("");
    setError("");
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (fromToken && toToken && value && parseFloat(value) > 0 && fromToken.pricePerToken && toToken.pricePerToken) {
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
      if (amount && toToken && tokenOnChain.pricePerToken && toToken.pricePerToken) {
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
      if (amount && fromToken && fromToken.pricePerToken && tokenOnChain.pricePerToken) {
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
    if (fromToken.symbol === toToken.symbol && fromTokenChain === toTokenChain) {
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
      return token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1);
    }
    return "Solana";
  };

  const isCrossChain = fromToken && toToken && (
    fromToken.chain !== toToken.chain ||
    (fromToken.evmChain && toToken.evmChain && fromToken.evmChain !== toToken.evmChain)
  );

  // Calculate gas estimate (mock)
  const gasEstimate = isCrossChain ? "~$15-25" : "~$5-10";
  const timeEstimate = isCrossChain ? "5-15 min" : "1-3 min";

  if (step === "loading") {
    return (
      <div className="wallet-card p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[color:var(--color-accent)] border-t-transparent" />
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Processing swap...
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60">
            {isCrossChain ? "Executing cross-chain swap" : "Executing swap"}
          </p>
          <p className="text-xs text-[color:var(--color-depth)]/50">
            This may take a few minutes
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="wallet-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Swap Successful
          </h2>
          <button
            onClick={handleClose}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-[color:var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Swap completed successfully!
          </p>
          <div className="mt-4 w-full space-y-2 rounded-2xl border border-[color:var(--color-border)] p-4">
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
          <button
            onClick={handleClose}
            className="mt-4 w-full rounded-xl bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="wallet-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Swap Failed
          </h2>
          <button
            onClick={handleClose}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Swap could not be completed
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60 text-center">
            The transaction failed. Please check your balance and try again.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setStep("form")}
              className="rounded-xl border border-[color:var(--color-border)] px-6 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
            >
              Try Again
            </button>
            <button
              onClick={handleClose}
              className="rounded-xl bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const fromValue = fromToken && amount && fromToken.pricePerToken
      ? parseFloat(amount) * fromToken.pricePerToken
      : 0;
    const toValue = toToken && estimatedAmount && toToken.pricePerToken
      ? parseFloat(estimatedAmount) * toToken.pricePerToken
      : 0;

    return (
      <div className="wallet-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Confirm Swap
          </h2>
          <button
            onClick={() => setStep("form")}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
            <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">From</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
                {fromToken?.symbol[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{fromToken?.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    {getChainLabel(fromToken!)}
                  </p>
                  {fromToken?.evmChain && <ChainLogo chain={fromToken.evmChain} />}
                  {fromToken?.chain === "Solana" && <ChainLogo chain="solana" />}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {amount} {fromToken?.symbol}
                </p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  ≈ ${fromValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwapTokens}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-[color:var(--color-depth)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M7 10H4l3-3 3 3H7zm10 4h3l-3 3-3-3h3zM7 10h13M17 14H4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
            <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">To</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
                {toToken?.symbol[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{toToken?.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    {getChainLabel(toToken!)}
                  </p>
                  {toToken?.evmChain && <ChainLogo chain={toToken.evmChain} />}
                  {toToken?.chain === "Solana" && <ChainLogo chain="solana" />}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {estimatedAmount} {toToken?.symbol}
                </p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  ≈ ${toValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Swap Type</p>
              <p className="font-semibold">{isCrossChain ? "Cross-Chain" : "Same-Chain"}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Estimated Gas</p>
              <p className="font-semibold">{gasEstimate}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Estimated Time</p>
              <p className="font-semibold">{timeEstimate}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Route</p>
              <p className="font-semibold">
                {isCrossChain ? "Rubic/Jupiter" : "Uniswap/Curve"}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep("form")}
              className="flex-1 rounded-xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Confirm Swap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">Swap</h2>
        <button
          onClick={handleClose}
          className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            From
          </label>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {Object.entries(groupedTokens)
              .filter(([symbol]) => !toToken || symbol !== toToken.symbol)
              .map(([symbol, tokens]) => {
                const totalAmount = tokens.reduce((sum, t) => sum + t.amount, 0);
                const totalValue = tokens.reduce((sum, t) => sum + t.usdValue, 0);
                const firstToken = tokens[0];

                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => handleFromTokenSelect(symbol)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                      fromToken?.symbol === symbol
                        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                        : "border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
                        {symbol[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{firstToken.name}</p>
                          {tokens.length > 1 && (
                            <span className="rounded-full bg-[color:var(--color-depth)]/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--color-depth)]/70">
                              {tokens.length} chains
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[color:var(--color-depth)]/60">
                          {totalAmount.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          {symbol}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </button>
                );
              })}
          </div>
        </div>

        {fromToken && fromTokenChains.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Select Chain (From)
            </label>
            <select
              value={fromTokenChain || ""}
              onChange={(e) => handleFromChainSelect(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
            >
              {fromTokenChains.map((token) => {
                const chainKey = token.evmChain
                  ? `${token.chain}-${token.evmChain}`
                  : token.chain;
                const chainLabel = getChainLabel(token);
                return (
                  <option key={chainKey} value={chainKey}>
                    {chainLabel} - {token.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {token.symbol} (${token.usdValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {fromToken && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Amount
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                step="any"
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (fromToken) {
                    handleAmountChange(fromToken.amount.toString());
                  }
                }}
                className="rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-[color:var(--color-accent)] transition hover:bg-[color:var(--color-depth)]/5"
              >
                Max
              </button>
            </div>
            {fromToken && amount && fromToken.pricePerToken && (
              <p className="mt-2 text-sm text-[color:var(--color-depth)]/60">
                ≈ ${(parseFloat(amount) * fromToken.pricePerToken).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwapTokens}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-[color:var(--color-depth)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M7 10H4l3-3 3 3H7zm10 4h3l-3 3-3-3h3zM7 10h13M17 14H4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            To
          </label>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {Object.entries(groupedTokens)
              .filter(([symbol]) => !fromToken || symbol !== fromToken.symbol)
              .map(([symbol, tokens]) => {
                const totalAmount = tokens.reduce((sum, t) => sum + t.amount, 0);
                const totalValue = tokens.reduce((sum, t) => sum + t.usdValue, 0);
                const firstToken = tokens[0];

                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => handleToTokenSelect(symbol)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                      toToken?.symbol === symbol
                        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                        : "border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
                        {symbol[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{firstToken.name}</p>
                          {tokens.length > 1 && (
                            <span className="rounded-full bg-[color:var(--color-depth)]/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--color-depth)]/70">
                              {tokens.length} chains
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[color:var(--color-depth)]/60">
                          {totalAmount.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          {symbol}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </button>
                );
              })}
          </div>
        </div>

        {toToken && toTokenChains.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Select Chain (To)
            </label>
            <select
              value={toTokenChain || ""}
              onChange={(e) => handleToChainSelect(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
            >
              {toTokenChains.map((token) => {
                const chainKey = token.evmChain
                  ? `${token.chain}-${token.evmChain}`
                  : token.chain;
                const chainLabel = getChainLabel(token);
                return (
                  <option key={chainKey} value={chainKey}>
                    {chainLabel} - {token.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {token.symbol} (${token.usdValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {toToken && estimatedAmount && (
          <div className="rounded-2xl border border-[color:var(--color-border)] p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Estimated Receive</p>
            <p className="mt-1 text-xl font-semibold">
              {estimatedAmount} {toToken.symbol}
            </p>
            {toToken.pricePerToken && (
              <p className="mt-1 text-sm text-[color:var(--color-depth)]/60">
                ≈ ${(parseFloat(estimatedAmount) * toToken.pricePerToken).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={!fromToken || !toToken || !amount}
          className="w-full rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
