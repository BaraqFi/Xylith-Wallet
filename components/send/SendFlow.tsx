"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance, EVMChain } from "../wallet/data";
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
import { Check, X, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, Address } from "viem";
import { useTransactionBuilder } from "@/hooks/useTransactionBuilder";
import { TransactionDetails } from "./TransactionDetails";
import { solanaClient } from "@/lib/solana/client";
import { SystemProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";

type SendStep = "form" | "confirm" | "loading" | "success" | "error";

export function SendFlow({ tokens }: { tokens: TokenBalance[] }) {
  const { setCurrentView, preselectedToken, setPreselectedToken } = useApp();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { buildTransaction, preview, isBuilding, error: buildError, clearPreview } = useTransactionBuilder();

  const [step, setStep] = useState<SendStep>("form");

  const [selectedGroup, setSelectedGroup] = useState<GroupedToken | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(preselectedToken);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [selectedChainFilter, setSelectedChainFilter] = useState<"EVM" | "Solana" | "all">("all");

  const groupedTokens = useMemo(() => {
    const filtered = tokens.filter(t => selectedChainFilter === 'all' || t.chain === selectedChainFilter);
    return groupTokensBySymbol(filtered);
  }, [tokens, selectedChainFilter]);

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
    const tokenOnChain = selectedGroup.chains.find((t) => {
      const key = t.evmChain ? `${t.chain}-${t.evmChain}` : t.chain;
      return key === chainKey;
    });
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

    /* Solana block removed */

    const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
    if (!wallet?.address) {
      setError("Wallet not connected");
      return;
    }

    if (!hasInsufficientBalance) {
      setError("");
    }

    try {
      if (isEvm && selectedToken.evmChain) {
        await buildTransaction(selectedToken, recipient as Address, amount, selectedToken.evmChain, wallet.address as Address);
      }
      setStep("confirm");
    } catch (err: any) {
      if (hasInsufficientBalance || err.message?.toLowerCase().includes("insufficient")) {
        // Create a fallback preview so the user can see the details and the error
        // Cast to any to bypass strict type checks for the fallback
        const fallbackPreview: any = {
          transactionData: { to: recipient, value: 0, data: "0x" },
          recipient,
          amount,
          token: selectedToken!, // We checked !selectedToken earlier in handleNext, so this is safe
          chain: selectedToken?.evmChain || "Ethereum",
          gasEstimate: "Unknown",
          gasPrice: "0",
          totalCost: "0"
        };

        // We need to inject this fake preview into the component state.
        // Since useTransactionBuilder doesn't expose a setter, we'll strip the preview check in the render 
        // OR we can make buildTransaction return this fallback?
        // Actually, we can just use a trick: bypass the check in render by checking for error state?
        // No, TransactionDetails NEEDS data.

        // Best hack: Render it here? No, we need to continue using the component structure.
        // I will MODIFY the render check in SendFlow to allow this.
        // Wait, I can't set "preview" state from here because it's inside the hook.

        // Change: I will ignore the hook's preview if it's null AND we have insufficient balance,
        // and instead pass a constructed object to TransactionDetails.

        // To do that, I need to change lines 242 and 252.
        // So for THIS block, I will just set the step. I will modify the RENDER logic in another chunk.
        setError("");
        setStep("confirm");
      } else {
        setError(err.message || "Failed to build transaction");
      }
    }
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
      const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
      if (!wallet?.address) {
        throw new Error("Wallet not connected");
      }

      if (isEvm && selectedToken.evmChain && preview) {
        // --- EVM Transaction ---
        const chainId = getChainId(selectedToken);
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          chain: { id: chainId } as any,
          transport: custom(provider)
        });

        const hash = await walletClient.sendTransaction({
          account: wallet.address as Address,
          to: preview.transactionData.to,
          value: preview.transactionData.value,
          data: preview.transactionData.data,
        } as any);

        setTxHash(hash);
        setStep("success");
        clearPreview();
      } else {
        // --- Solana Transaction ---
        const solanaWallet = wallets.find(w => (w as any).chainType === 'solana');
        if (!solanaWallet) {
          throw new Error("Solana wallet not connected");
        }

        const fromPubkey = new PublicKey(wallet.address);
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
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              fromPubkey,
              amountLamports
            )
          );
        }

        // Get recent blockhash
        const response = await fetch(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [{ commitment: 'confirmed' }],
          }),
        });
        const blockhashData = await response.json();
        if (blockhashData.error) throw new Error(blockhashData.error.message);

        transaction.recentBlockhash = blockhashData.result.value.blockhash;
        transaction.feePayer = fromPubkey;

        // Sign transaction
        const signedTx = await (solanaWallet as any).signTransaction(transaction);

        // Send transaction
        const serializedTx = signedTx.serialize();
        const signature = await solanaClient.sendRawTransaction(
          Buffer.from(serializedTx).toString('base64')
        );

        setTxHash(signature);
        setStep("success");
      }
    } catch (err: any) {
      console.error("Transaction failed:", err);
      setError(err.message || "Transaction failed");
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

  // Log build errors to console (not displayed in UI)
  useEffect(() => {
    if (buildError) {
      console.error("Transaction build error:", buildError);
    }
  }, [buildError]);

  if (step === "confirm") {
    // If we have insufficient balance, we might not have a preview, but we still want to show the confirmation screen with the error.
    if (!preview && !insufficientBalance) {
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
                      {group.chains.map(chainToken =>
                        chainToken.evmChain ? (
                          <ChainLogo key={chainToken.evmChain} chain={chainToken.evmChain} />
                        ) : chainToken.chain === 'Solana' ? (
                          <ChainLogo key="solana" chain="solana" />
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
              value={selectedToken ? (selectedToken.evmChain ? `${selectedToken.chain}-${selectedToken.evmChain}` : selectedToken.chain) : ""}
              onValueChange={handleChainSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {selectedGroup.chains.map((token) => {
                  const chainKey = token.evmChain ? `${token.chain}-${token.evmChain}` : token.chain;
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

