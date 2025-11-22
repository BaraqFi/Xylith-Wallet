"use client";

import { useState } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, TokenBalance } from "./data";
import { ChainLogo } from "./ManualWallet";

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

  const [selectedChainFilter, setSelectedChainFilter] = useState<"EVM" | "Solana" | "all">("all");
  const [selectedTokenChain, setSelectedTokenChain] = useState<string | null>(() => {
    if (preselectedToken) {
      return preselectedToken.evmChain
        ? `${preselectedToken.chain}-${preselectedToken.evmChain}`
        : preselectedToken.chain;
    }
    return null;
  });
  
  const availableTokens = manualWalletState.tokens.filter((t) => {
    if (selectedChainFilter === "all") return true;
    return t.chain === selectedChainFilter;
  });

  // Group tokens by symbol for better display
  const groupedTokens = availableTokens.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(token);
    return acc;
  }, {} as Record<string, typeof availableTokens>);

  // Get available chains for selected token
  const selectedTokenChains = selectedToken
    ? groupedTokens[selectedToken.symbol] || []
    : [];

  // Update selectedToken when chain changes
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

  if (step === "loading") {
    return (
      <div className="wallet-card p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[color:var(--color-accent)] border-t-transparent" />
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
            Transaction successful!
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60 text-center">
            {amount} {selectedToken?.symbol} has been sent to {recipient.slice(0, 6)}...
            {recipient.slice(-4)}
          </p>
          <button
            onClick={handleClose}
            className="mt-4 rounded-xl bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
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
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">
            Transaction failed
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60 text-center">
            The transaction could not be completed. Please try again.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setStep("form")}
              className="rounded-xl border border-[color:var(--color-depth)]/20 px-6 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
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
    return (
      <div className="wallet-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
            Confirm Transaction
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

        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Token</p>
            <p className="mt-1 text-lg font-semibold">{selectedToken?.name}</p>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Amount</p>
            <p className="mt-1 text-lg font-semibold">
              {amount} {selectedToken?.symbol}
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Recipient</p>
            <p className="mt-1 break-all font-mono text-sm">{recipient}</p>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <p className="text-sm text-[color:var(--color-depth)]/60">Network</p>
            <p className="mt-1 text-lg font-semibold">{manualWalletState.activeChain}</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep("form")}
              className="flex-1 rounded-xl border border-[color:var(--color-depth)]/20 px-4 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Confirm & Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">Send</h2>
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
          <div className="mb-3 flex items-center justify-between">
            <label className="block text-sm font-medium text-[color:var(--color-depth)]">
              Select Token
            </label>
            <div className="flex gap-2 rounded-full border border-[color:var(--color-border)] p-1">
              {(["all", "EVM", "Solana"] as const).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setSelectedChainFilter(chain)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedChainFilter === chain
                      ? "bg-[color:var(--color-accent)] text-white"
                      : "text-[color:var(--color-depth)]/60"
                  }`}
                >
                  {chain === "all" ? "All" : chain}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {Object.entries(groupedTokens).map(([symbol, tokens]) => {
              const totalAmount = tokens.reduce((sum, t) => sum + t.amount, 0);
              const totalValue = tokens.reduce((sum, t) => sum + t.usdValue, 0);
              const firstToken = tokens[0];

              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => {
                    // If multiple chains, select the one with highest value
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
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    selectedToken?.symbol === symbol &&
                    selectedToken?.evmChain === firstToken.evmChain &&
                    selectedToken?.chain === firstToken.chain
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[color:var(--color-depth)]/60">
                          {totalAmount.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          {symbol}
                        </p>
                        {tokens.length === 1 && tokens[0].evmChain && (
                          <ChainLogo chain={tokens[0].evmChain} />
                        )}
                        {tokens.length === 1 && tokens[0].chain === "Solana" && (
                          <ChainLogo chain="solana" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            <select
              value={selectedTokenChain || ""}
              onChange={(e) => handleChainSelect(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
            >
              {selectedTokenChains.map((token) => {
                const chainKey = token.evmChain
                  ? `${token.chain}-${token.evmChain}`
                  : token.chain;
                const chainLabel = token.evmChain
                  ? `${token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)}`
                  : "Solana";
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

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            Recipient Address
          </label>
          <input
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
            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-transparent px-4 py-3 font-mono text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
            Amount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder="0.00"
              step="any"
              className="flex-1 rounded-2xl border border-[color:var(--color-depth)]/10 bg-transparent px-4 py-3 text-sm transition focus:border-[color:var(--color-accent)] focus:outline-none"
            />
            {selectedToken && (
              <button
                type="button"
                onClick={() => setAmount(selectedToken.amount.toString())}
                className="rounded-2xl border border-[color:var(--color-depth)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-accent)] transition hover:bg-[color:var(--color-depth)]/5"
              >
                Max
              </button>
            )}
          </div>
          {selectedToken && amount && selectedToken.pricePerToken && (
            <p className="mt-2 text-sm text-[color:var(--color-depth)]/60">
              ≈ ${(parseFloat(amount) * selectedToken.pricePerToken).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleNext}
          className="w-full rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

