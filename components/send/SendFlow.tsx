"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance, isNativeTokenAddress } from "../wallet/data";
import { groupTokensBySymbol, GroupedToken } from "../wallet/utils";
import { TokenLogo } from "../wallet/TokenLogo";
import { ChainLogo } from "../wallet/ChainLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Loader2, Search } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
// Solana wallets are NOT in the main useWallets() (Ethereum-only); they come
// from the dedicated solana entrypoint.
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { pickSolanaWallet, signSolanaTransactionBytes } from "@/lib/solana/privyWallet";
import { Address } from "viem";
import { Buffer } from "buffer";
import { useTransactionBuilder } from "@/hooks/useTransactionBuilder";

interface JupiterToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI: string;
}

interface EvmSearchResult {
  symbol: string;
  name: string;
  evmChain?: string;
  amount?: number;
  usdValue?: number;
  contractAddress: string;
  decimals?: number;
  logo?: string;
}

import { TransactionDetails } from "./TransactionDetails";
import { solanaClient } from "@/lib/solana/client";
import { SystemProgram, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

type SendStep = "form" | "confirm" | "loading" | "success" | "error";

const getTokenInstanceKey = (token: TokenBalance): string => {
  const chainId = token.evmChain || 'solana';
  // Native tokens are keyed by symbol: the EVM native sentinel is shared across
  // chains, and 'So111...112' (wrapped SOL) stands in for native SOL.
  const isEvmNative = token.chain === 'EVM' && isNativeTokenAddress(token.contractAddress);
  const isSolNative = token.contractAddress === 'So11111111111111111111111111111111111111112';
  if (!token.contractAddress || isEvmNative || isSolNative) {
    return `${token.chain}-${chainId}-${token.symbol}`;
  }
  // For ERC20s or SPL tokens, the contract address is the unique identifier.
  return `${token.chain}-${chainId}-${token.contractAddress}`;
};

export function SendFlow({ tokens }: { tokens: TokenBalance[] }) {
  const { setCurrentView, preselectedToken, setPreselectedToken } = useApp();
  const { user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { buildTransaction, preview, error: buildError, clearPreview } = useTransactionBuilder();

  const [step, setStep] = useState<SendStep>("form");

  const [selectedGroup, setSelectedGroup] = useState<GroupedToken | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(preselectedToken);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [selectedChainFilter, setSelectedChainFilter] = useState<"EVM" | "Solana" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteSearchResults, setRemoteSearchResults] = useState<TokenBalance[]>([]);

  // Log build errors to console (not displayed in UI)
  useEffect(() => {
    if (buildError) {
      console.error("Transaction build error:", buildError);
    }
  }, [buildError]);

  // Search handler for contract address and token name
  const handleSearch = useCallback(async (query: string): Promise<TokenBalance[]> => {
    if (!query || query.trim().length < 2) return [];

    try {
      // Determine which chain to search based on filter
      const searchChain = selectedChainFilter === "Solana" ? "Solana" :
        selectedChainFilter === "EVM" ? "EVM" : "EVM"; // Default to EVM if "all"

      if (searchChain === "Solana") {
        const res = await fetch(`/api/jupiter/tokens?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        return data.map((t: JupiterToken) => ({
          symbol: t.symbol,
          name: t.name,
          chain: "Solana",
          amount: 0,
          usdValue: 0,
          contractAddress: t.address,
          decimals: t.decimals,
          logo: t.logoURI,
        }));
      } else {
        // For EVM, we need to determine which EVM chain to search
        // Since we don't have a specific EVM chain selected in send flow, default to ethereum
        // Or we could search all EVM chains, but that's complex. Let's default to ethereum.
        const evmChain = "ethereum"; // Could be made dynamic based on user's tokens
        const res = await fetch(
          `/api/evm/search?query=${encodeURIComponent(query)}&chain=${evmChain}`
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Search failed");
        }
        const data = await res.json();
        return data.map((t: EvmSearchResult) => ({
          symbol: t.symbol,
          name: t.name,
          chain: "EVM",
          evmChain: t.evmChain || evmChain,
          amount: t.amount || 0,
          usdValue: t.usdValue || 0,
          contractAddress: t.contractAddress,
          decimals: t.decimals || 18,
          logo: t.logo,
        }));
      }
    } catch (err) {
      console.error("Token search failed", err);
      return [];
    }
  }, [selectedChainFilter]);

  // Remote search effect
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setRemoteSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await handleSearch(searchQuery);
        setRemoteSearchResults(results);
      } catch (e) {
        console.error("Remote search error:", e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Filter tokens locally
  const localFilteredTokens = useMemo(() => {
    const filtered = tokens.filter(t => selectedChainFilter === 'all' || t.chain === selectedChainFilter);

    if (!searchQuery) return filtered;

    const s = searchQuery.toLowerCase().trim();
    return filtered.filter((token) => {
      return (
        token.symbol.toLowerCase().includes(s) ||
        token.name.toLowerCase().includes(s) ||
        token.contractAddress?.toLowerCase().includes(s)
      );
    });
  }, [tokens, selectedChainFilter, searchQuery]);



  const groupedTokens = useMemo(() => {
    return groupTokensBySymbol(localFilteredTokens);
  }, [localFilteredTokens]);

  const handleGroupSelect = (group: GroupedToken) => {
    setSelectedGroup(group);
    // If there's only one chain, auto-select it. Otherwise, wait for user to select a chain.
    if (group.chains.length === 1) {
      setSelectedToken(group.chains[0]);
    } else {
      setSelectedToken(null); // Force user to pick a chain
    }
    setError("");
  };

  const handleChainSelect = (chainKey: string) => {
    if (!selectedGroup) return;
    const tokenOnChain = selectedGroup.chains.find((t) => getTokenInstanceKey(t) === chainKey);
    if (tokenOnChain) {
      setSelectedToken(tokenOnChain);
    }
  };

  const handleNext = async () => {
    if (!selectedToken) {
      setError("Please select a token and chain");
      return;
    }
    if (!recipient) {
      setError("Please enter a recipient address");
      return;
    }
    const isEvm = selectedToken?.chain === "EVM";
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (isEvm && !evmRegex.test(recipient)) {
      setError("Please enter a valid EVM address (0x...)");
      return;
    }
    if (!isEvm && !solanaRegex.test(recipient)) {
      setError("Please enter a valid Solana address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const hasInsufficientBalance = parseFloat(amount) > selectedToken.amount;
    setInsufficientBalance(hasInsufficientBalance);

    if (isEvm) {
      const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
      if (!wallet?.address) {
        setError("Wallet not connected");
        return;
      }

      if (!hasInsufficientBalance) setError("");

      try {
        if (selectedToken.evmChain) {
          await buildTransaction(selectedToken, recipient as Address, amount, selectedToken.evmChain, wallet.address as Address);
        }
        setStep("confirm");
      } catch (err: unknown) {
        const errorMessage = (err as Error)?.message || "";
        if (hasInsufficientBalance || errorMessage.toLowerCase().includes("insufficient")) {
          // Show the confirm screen anyway: the render falls back to a stub
          // preview and TransactionDetails surfaces the insufficient balance.
          setError("");
          setStep("confirm");
        } else {
          setError(errorMessage || "Failed to build transaction");
        }
      }
      return;
    }

    // Solana: there is no EVM-style preview to build here — the confirm screen
    // renders a fallback preview and the transaction is assembled on confirm.
    const solanaWallet = pickSolanaWallet(solanaWallets);
    if (!solanaWallet?.address) {
      setError("Solana wallet not connected");
      return;
    }
    if (!hasInsufficientBalance) setError("");
    setStep("confirm");
  };

  // Helper function to get chain ID from token (same as SwapFlow)
  const getChainId = (t: TokenBalance | null): number => {
    if (!t) return 1;
    if (t.chain === 'Solana') return 0;
    switch (t.evmChain) {
      case 'ethereum': return 1;
      case 'base': return 8453;
      case 'arbitrum': return 42161;
      case 'optimism': return 10;
      case 'polygon': return 137;
      case 'bsc': return 56;
      default: return 1;
    }
  };

  const handleConfirm = async () => {
    if (!selectedToken) {
      setError("Token not selected");
      return;
    }

    const isEvm = selectedToken.chain === "EVM";

    // EVM transactions require preview
    if (isEvm && (!preview || !selectedToken.evmChain)) {
      setError("Transaction preview not available");
      return;
    }

    setStep("loading");
    setError("");

    try {
      if (isEvm && selectedToken.evmChain && preview) {
        // --- EVM Transaction ---
        // Privy's sendTransaction switches the embedded wallet to the target
        // chain internally, so cross-chain sends land where they should.
        const { hash } = await sendTransaction({
          to: preview.transactionData.to,
          value: preview.transactionData.value,
          data: preview.transactionData.data ?? "0x",
          chainId: getChainId(selectedToken),
        });

        setTxHash(hash);
        setStep("success");
        clearPreview();
      } else {
        // --- Solana Transaction ---
        const solanaWallet = pickSolanaWallet(solanaWallets);
        if (!solanaWallet?.address) {
          throw new Error("Solana wallet not connected");
        }

        const fromPubkey = new PublicKey(solanaWallet.address);
        const toPubkey = new PublicKey(recipient);
        const decimals = selectedToken.decimals ?? 9;
        const amountLamports = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

        // Check if it's native SOL or SPL token
        const isNativeSOL = !selectedToken.contractAddress ||
          selectedToken.contractAddress === "So11111111111111111111111111111111111111112";

        let transaction: Transaction;

        if (isNativeSOL) {
          // Native SOL transfer
          transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: toPubkey,
              lamports: amountLamports,
            })
          );
        } else {
          // SPL Token transfer
          if (!selectedToken.contractAddress) {
            throw new Error("Token contract address is required for SPL token transfers");
          }
          const mintPubkey = new PublicKey(selectedToken.contractAddress);
          const fromTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            fromPubkey
          );
          const toTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            toPubkey
          );

          transaction = new Transaction().add(
            // The recipient may never have held this token; creating their ATA
            // idempotently is a no-op when it already exists.
            createAssociatedTokenAccountIdempotentInstruction(
              fromPubkey,
              toTokenAccount,
              toPubkey,
              mintPubkey
            ),
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              fromPubkey,
              amountLamports
            )
          );
        }

        transaction.recentBlockhash = await solanaClient.getLatestBlockhash();
        transaction.feePayer = fromPubkey;

        // Wallet-standard signing: serialized bytes in, signed bytes out.
        const unsignedBytes = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        const signedBytes = await signSolanaTransactionBytes(
          solanaWallet,
          new Uint8Array(unsignedBytes)
        );

        const signature = await solanaClient.sendRawTransaction(
          Buffer.from(signedBytes).toString('base64')
        );

        setTxHash(signature);
        setStep("success");
      }
    } catch (err: unknown) {
      console.error("Transaction failed:", err);
      if (err instanceof Error) {
        setError(err.message || "Transaction failed");
      } else {
        setError("Transaction failed");
      }
      setStep("error");
    }
  };

  const handleClose = () => {
    setCurrentView("wallet");
    setStep("form");
    setSelectedToken(null);
    setPreselectedToken(null);
    setSelectedGroup(null);
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
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">Processing transaction...</p>
          <p className="text-sm text-[color:var(--color-depth)]/60">Please wait while we send your transaction</p>
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
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">Transaction successful!</p>
          <p className="text-sm text-center text-[color:var(--color-depth)]/60">
            {amount} {selectedToken?.symbol} has been sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
          {txHash && (
            <p className="text-xs text-center text-[color:var(--color-depth)]/50 font-mono break-all">
              TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
          )}
          <Button onClick={handleClose} className="mt-4">Close</Button>
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
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">Transaction failed</p>
          <p className="text-sm text-center text-[color:var(--color-depth)]/60">The transaction could not be completed. Please try again.</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setStep("form")}>Try Again</Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }



  if (step === "confirm") {
    // Solana sends and insufficient-balance cases have no built preview; the
    // fallback object below covers them. Only EVM sends still building wait here.
    if (!preview && !insufficientBalance && selectedToken?.chain !== "Solana") {
      return (
        <div className="wallet-card p-8">{renderHeader("Confirm Transaction")}<div className="py-8 text-center"><p className="text-[color:var(--color-depth)]/60">Loading transaction details...</p></div></div>
      );
    }
    return (
      <div className="wallet-card p-8">
        {renderHeader("Confirm Transaction")}
        <TransactionDetails
          preview={preview || {
            transactionData: { to: recipient, value: 0, data: "0x" },
            recipient,
            amount,
            token: selectedToken!,
            chain: selectedToken?.evmChain || (selectedToken?.chain === 'Solana' ? 'Solana' : "Ethereum"),
            gasEstimate: "Unknown",
            gasPrice: "0",
            totalCost: "0"
          } as any}
          selectedToken={selectedToken}
          insufficientBalance={insufficientBalance}
          onEdit={() => { clearPreview(); setStep("form"); setInsufficientBalance(false); }}
          onConfirm={handleConfirm}
          isConfirming={false} // Loading state is handled by the parent component's "loading" step
        />
      </div>
    );
  }

  return (
    <div className="wallet-card p-6 md:p-8">
      {renderHeader("Send")}
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="block text-sm font-medium text-[color:var(--color-depth)]">Select Token</label>
            <div className="flex gap-1 rounded-full border border-[color:var(--color-border)] p-1">
              {(["all", "EVM", "Solana"] as const).map((chain) => (
                <Button key={chain} size="sm" variant={selectedChainFilter === chain ? "secondary" : "ghost"} onClick={() => setSelectedChainFilter(chain)} className="rounded-full text-xs">{chain === "all" ? "All" : chain}</Button>
              ))}
            </div>
          </div>
          <div className="mb-3 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-depth)]/40">
              <Search size={18} />
            </div>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by token name or symbol"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[color:var(--color-depth)]/5 border-transparent focus:bg-transparent focus:border-[color:var(--color-accent)]/30 transition-all"
            />
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto p-1">
            {groupedTokens.map((group) => (
              <button
                key={group.symbol}
                type="button"
                onClick={() => handleGroupSelect(group)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${selectedGroup?.symbol === group.symbol
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                  : "border-transparent hover:bg-[color:var(--color-depth)]/5"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={group.symbol} name={group.name} />
                  <div>
                    <p className="font-semibold">{group.name}</p>
                    <div className="flex items-center gap-1 -space-x-2">
                      {group.chains.map((chainToken, idx) =>
                        chainToken.evmChain ? (
                          <ChainLogo key={`${group.symbol}-${chainToken.evmChain}-${idx}`} chain={chainToken.evmChain} />
                        ) : chainToken.chain === 'Solana' ? (
                          <ChainLogo key={`${group.symbol}-solana-${idx}`} chain="solana" />
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${group.totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedGroup && selectedGroup.chains.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">Select Chain</label>
            <Select
              value={selectedToken ? getTokenInstanceKey(selectedToken) : ""}
              onValueChange={handleChainSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {selectedGroup.chains.map((token) => {
                  const chainKey = getTokenInstanceKey(token);
                  const chainLabel = token.evmChain ? token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1) : "Solana";
                  return (
                    <SelectItem key={chainKey} value={chainKey}>
                      <div className="flex items-center gap-2">
                        <ChainLogo chain={token.evmChain || "solana"} />
                        <span>{chainLabel} - {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6, })} {token.symbol} (${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, })})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">Recipient Address</label>
          <Input type="text" value={recipient} onChange={(e) => { setRecipient(e.target.value); setError(""); }} placeholder={selectedToken?.chain === "Solana" ? "Enter Solana address..." : "0x..."} className="font-mono" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">Amount</label>
          <div className="flex gap-2">
            <Input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0.00" step="any" />
            {selectedToken && (<Button variant="secondary" onClick={() => setAmount(selectedToken.amount.toString())}>Max</Button>)}
          </div>
          {selectedToken && amount && selectedToken.pricePerToken && (
            <p className="mt-2 text-sm text-[color:var(--color-depth)]/60">
              ≈ ${(parseFloat(amount) * selectedToken.pricePerToken).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, })}
            </p>
          )}
        </div>

        {error && (<div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-600">{error}</p></div>)}
        <Button onClick={handleNext} className="w-full" size="lg" disabled={!selectedToken}>Continue</Button>
      </div>
    </div>
  );
}

