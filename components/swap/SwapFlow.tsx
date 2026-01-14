"use client";

import { useState, useEffect } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance } from "../wallet/data";
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
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { formatUnits, parseUnits, encodeFunctionData, parseAbi } from "viem";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useSwapQuote } from "@/hooks/useSwapQuote";
import { useSolanaSwapQuote } from "@/hooks/useSolanaSwapQuote";
import { useAllowance } from "@/hooks/useAllowance";
import { OneInchClient } from "@/lib/1inch/client";
import { useSwapTokenList } from "@/hooks/useSwapTokenList";
import { useSwapSecurity, useTokenSecurity } from "@/hooks/useSecurityCheck";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { solanaClient } from "@/lib/solana/client";
import { VersionedTransaction } from "@solana/web3.js";

// OneInch V6 Router
const AGGREGATION_ROUTER_V6 = "0x111111125421ca6dc452d289314280a0f8842a65";

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
    <DialogContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[50%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[50%] fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
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

  const { user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();

  // Determine active chain context
  const activeChainForBalances = fromToken ? fromToken.chain : "EVM";
  const activeEvmChainForBalances = fromToken && fromToken.evmChain ? fromToken.evmChain : "ethereum";

  const { balances: userTokenBalances } = useTokenBalances(activeChainForBalances, activeEvmChainForBalances);

  // Get comprehensive token list from 1inch (only for EVM chains to supplement)
  const { tokens: swapTokenList, isLoading: isLoadingTokenList } = useSwapTokenList(
    activeEvmChainForBalances,
    userTokenBalances
  );

  // If Solana, we mainly rely on user balances + default list for now (handled in hook)
  const tokens = activeChainForBalances === "EVM" && swapTokenList.length > 0
    ? swapTokenList
    : userTokenBalances;

  // --- EVM Quote Hook ---
  const getChainId = (t: TokenBalance | null) => {
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

  const {
    quote: evmQuote,
    swapTx: evmSwapTx,
    isLoading: isEvmQuoteLoading,
    error: evmQuoteError,
    fetchSwapTransaction: fetchEvmSwap
  } = useSwapQuote({
    fromToken,
    toToken,
    amount,
    chainId: getChainId(fromToken),
    slippage,
    address: user?.wallet?.address,
  });

  // --- Solana Quote Hook ---
  // Find Solana wallet address
  // We prioritize embedded first, then any linked. Note: embedded wallet *is* in linked accounts.
  // Actually, useWallets returns connected wallets. 
  // For embedded, it should be in wallets if connected (Privy handles this).
  const solanaWallet = wallets.find(w => (w as any).chainType === 'solana');
  const solanaAddress = solanaWallet?.address;

  const {
    quote: solQuote,
    swapTx: solSwapTx, // Base64 string from hook
    isLoading: isSolQuoteLoading,
    error: solQuoteError,
    fetchSwapTransaction: fetchSolSwap
  } = useSolanaSwapQuote({
    fromToken,
    toToken,
    amount,
    fromAddress: solanaAddress,
    slippage,
  });

  // Derived state based on active chain
  const isSolanaSwap = fromToken?.chain === 'Solana';
  const quote = isSolanaSwap ? solQuote : evmQuote;
  const isQuoteLoading = isSolanaSwap ? isSolQuoteLoading : isEvmQuoteLoading;
  const quoteError = isSolanaSwap ? solQuoteError : evmQuoteError;

  // Update estimated amount
  useEffect(() => {
    if (quote && toToken) {
      if (isSolanaSwap) {
        // Jupiter quote: outAmount is in atomic units (string/number)
        // Need to format using toToken decimals
        const outAmount = quote.outAmount || quote.dstAmount;
        const decimals = toToken.decimals || 6; // Default to 6 for USDC/USDT often, SOL is 9.
        if (outAmount) {
          const val = formatUnits(BigInt(outAmount), decimals);
          setEstimatedAmount(val);
        }
      } else {
        // 1inch quote: dstAmount (wei)
        const decimals = toToken.decimals || 18;
        if (quote.dstAmount) {
          const val = formatUnits(BigInt(quote.dstAmount), decimals);
          setEstimatedAmount(val);
        }
      }
    } else {
      if (!isQuoteLoading && !quote) setEstimatedAmount("");
    }
  }, [quote, toToken, isQuoteLoading, isSolanaSwap]);

  // Allowance Hook (EVM only)
  const { allowance, refetch: refetchAllowance } = useAllowance(
    fromToken?.contractAddress,
    AGGREGATION_ROUTER_V6,
    user?.wallet?.address,
    amount,
    fromToken?.evmChain
  );

  // Security Checks (EVM Only for now, skipping for Solana MVP)
  const swapSecurity = useSwapSecurity(evmQuote, slippage, step === "confirm" && !!evmQuote);
  const fromTokenSecurity = useTokenSecurity(
    fromToken?.contractAddress as any,
    fromToken?.evmChain,
    step === "confirm" && !!fromToken?.contractAddress && !!fromToken?.evmChain
  );
  const toTokenSecurity = useTokenSecurity(
    toToken?.contractAddress as any,
    toToken?.evmChain,
    step === "confirm" && !!toToken?.contractAddress && !!toToken?.evmChain
  );


  // Token Filtering & Grouping
  const tokensWithBalance = tokens.filter(t => t.amount > 0 || t.usdValue > 0);

  const groupedTokens = tokensWithBalance.reduce((acc, token) => {
    const key = token.symbol;
    if (!acc[key]) acc[key] = [];
    acc[key].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);

  const getRealBalance = (token: TokenBalance | null): number => {
    if (!token) return 0;
    // Find matching token in the FRESH token list (tokens)
    const realToken = tokens.find(
      (t) =>
        t.symbol === token.symbol &&
        t.chain === token.chain &&
        t.evmChain === token.evmChain &&
        (t.contractAddress === token.contractAddress ||
          (!t.contractAddress && !token.contractAddress))
    );
    return realToken?.amount ?? token.amount ?? 0;
  };

  const realFromTokenBalance = getRealBalance(fromToken);

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
    if (fromToken && value && parseFloat(value) > 0) {
      const balance = getRealBalance(fromToken);
      const newPercentage = balance > 0 ? (parseFloat(value) / balance) * 100 : 0;
      setPercentage(Math.min(100, Math.max(0, Math.round(newPercentage))));
    } else {
      setPercentage(0);
    }
    setEstimatedAmount(""); // Clear until quote
  };

  const handlePercentageChange = (value: number) => {
    setPercentage(value);
    if (fromToken && value > 0) {
      const newAmount = (realFromTokenBalance * value) / 100;
      // Truncate based on decimals to avoid dust issues
      // Simple 6 decimals for now as safe bet
      setAmount(newAmount.toFixed(6));
      if (toToken) setEstimatedAmount("");
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

    // Reset ToToken if chain compatibility issue (Isolation)
    if (toToken && toToken.chain !== token.chain) {
      setToToken(null);
      setToTokenChain(null);
    }

    setAmount("");
    setEstimatedAmount("");
    setPercentage(0);
    setError("");
    setPreselectedToken(null);
  };

  const handleToTokenSelect = (token: TokenBalance) => {
    // Chain Isolation Check
    if (fromToken && fromToken.chain !== token.chain) {
      // This shouldn't be possible if modal filters correctly, but safety check
      return;
    }
    setToToken(token);
    const chainKey = token.evmChain
      ? `${token.chain}-${token.evmChain}`
      : token.chain;
    setToTokenChain(chainKey);
    setEstimatedAmount("");
    setError("");
  };

  const handleNext = () => {
    if (!fromToken || !toToken) {
      setError("Please select both tokens");
      return;
    }
    if (fromToken.chain !== toToken.chain) {
      setError("Cross-chain swaps are not currently supported using this interface");
      return;
    }
    if (
      fromToken.symbol === toToken.symbol &&
      fromTokenChain === toTokenChain
    ) {
      setError("Cannot swap the same token");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) > realFromTokenBalance) {
      setError("Insufficient balance");
      return;
    }

    // Check Quote Error
    if (quoteError) {
      // More specific error message if available
      setError("Unable to fetch a quote. The pair might have low liquidity or API limits.");
      return;
    }

    setError("");
    setStep("confirm");
  };

  const [isApproving, setIsApproving] = useState(false);

  // EVM Approval
  const handleApprove = async () => {
    if (!fromToken || !fromToken.contractAddress || isSolanaSwap) return;
    const isNativeToken =
      fromToken.contractAddress.toLowerCase() ===
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    if (isNativeToken) return;

    setIsApproving(true);
    try {
      const amountWei = parseUnits(amount, fromToken.decimals || 18);
      const data = encodeFunctionData({
        abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
        functionName: 'approve',
        args: [AGGREGATION_ROUTER_V6, amountWei]
      });

      const txHash = await sendTransaction({
        to: fromToken.contractAddress,
        data: data,
        chainId: getChainId(fromToken),
      });

      setTimeout(() => {
        refetchAllowance();
        setIsApproving(false);
      }, 5000);
    } catch (err) {
      console.error("Approve Failed:", err);
      setIsApproving(false);
    }
  };

  const handleConfirm = async () => {
    setStep("loading");

    try {
      if (isSolanaSwap) {
        // --- SOLANA SWAP ---
        if (!solanaWallet) throw new Error("Solana wallet not connected");

        // 1. Fetch Transaction Buffer (Base64)
        const txBase64 = await fetchSolSwap();
        if (!txBase64) throw new Error("Failed to prepare Solana transaction");

        // 2. Deserialize
        const txBuffer = Buffer.from(txBase64, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);

        // 3. Sign
        // solanaWallet from useWallets has signTransaction
        const signedTx = await (solanaWallet as any).signTransaction(transaction);

        // 4. Send (Broadcast)
        // Serialize signed transaction
        const serializedTx = signedTx.serialize();
        const signature = await solanaClient.sendRawTransaction(
          Buffer.from(serializedTx).toString('base64')
        );

        console.log("Solana Swap Executed:", signature);
        setStep("success");

      } else {
        // --- EVM SWAP ---
        const txData = await fetchEvmSwap();
        if (!txData || !txData.tx) throw new Error("Failed to prepare transaction");

        const txHash = await sendTransaction({
          to: txData.tx.to,
          data: txData.tx.data,
          value: BigInt(txData.tx.value),
          chainId: getChainId(fromToken),
        });

        console.log("EVM Swap Executed:", txHash);
        setStep("success");
      }
    } catch (err: any) {
      console.error("Swap Failed:", err);
      setError(err.message || "Swap failed");
      setStep("error");
    }
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

  // Gas Estimation Logic
  const formatGasEstimate = () => {
    if (isSolanaSwap) return "~0.000005 SOL"; // Typical Solana gas
    if (evmQuote?.gas && evmQuote?.gasPrice) {
      const gasInGwei = BigInt(evmQuote.gasPrice) / BigInt(1e9);
      const gasCost = (Number(evmQuote.gas) * Number(gasInGwei)) / 1e9;
      return `~${gasCost.toFixed(4)} ETH`;
    }
    return "~$5-10";
  };

  const gasEstimate = formatGasEstimate();
  const timeEstimate = isSolanaSwap ? "< 1 min" : "1-3 min";
  const routeLabel = isSolanaSwap ? "Jupiter" : "1inch";

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
            Executing swap on {isSolanaSwap ? "Solana" : "EVM"}
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
                {amount} {fromToken?.symbol}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Received</p>
              <p className="font-semibold">
                {estimatedAmount} {toToken?.symbol}
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
          <p className="text-sm text-center text-[color:var(--color-depth)]/60 px-4">
            {error}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Route</p>
              <p className="font-semibold text-sm">{routeLabel}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Net. Fee</p>
              <p className="font-semibold text-sm">{gasEstimate}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Time</p>
              <p className="font-semibold text-sm">{timeEstimate}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Slippage</p>
              <p className="font-semibold text-sm">{slippage}%</p>
            </div>
          </div>

          {/* EVM Approvals */}
          {!isSolanaSwap && !isApproving && allowance !== undefined && allowance < parseFloat(amount) && (
            <Button
              onClick={handleApprove}
              className="w-full bg-[color:var(--color-accent)]"
              disabled={isApproving}
            >
              {isApproving ? "Approving..." : `Approve ${fromToken?.symbol}`}
            </Button>
          )}

          {/* Confirm Button */}
          {(!isSolanaSwap && allowance !== undefined && allowance < parseFloat(amount)) ? null : (
            <Button onClick={handleConfirm} className="w-full bg-[color:var(--color-accent)]">
              Confirm Swap
            </Button>
          )}

          <Button variant="ghost" onClick={() => setStep("form")} className="w-full">
            Back
          </Button>

        </div>
      </div>
    );
  }

  // Form Step
  return (
    <div className="wallet-card p-4 sm:p-8">
      {renderHeader("Swap")}

      <div className="space-y-4">
        {/* FROM Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-[color:var(--color-depth)]/60">
              From
            </label>
            <span className="text-sm text-[color:var(--color-depth)]/60">
              Balance: {realFromTokenBalance.toFixed(4)}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="w-[140px] flex-shrink-0">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 px-3"
                onClick={() => setShowFromTokenModal(true)}
              >
                {fromToken ? (
                  <>
                    <TokenLogo symbol={fromToken.symbol} name={fromToken.name} size="sm" />
                    <span className="truncate">{fromToken.symbol}</span>
                  </>
                ) : (
                  "Select"
                )}
              </Button>
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="flex-1 text-right font-mono text-lg"
            />
          </div>
          {/* Percentage buttons */}
          <div className="flex gap-2 justify-end">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercentageChange(pct)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${percentage === pct
                  ? "bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]"
                  : "bg-[color:var(--color-depth)]/5 hover:bg-[color:var(--color-depth)]/10"
                  }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center py-2">
          <Button variant="ghost" size="icon" onClick={handleSwapTokens} className="rounded-full bg-[color:var(--color-depth)]/5">
            <ArrowUpDown className="h-5 w-5" />
          </Button>
        </div>

        {/* TO Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-[color:var(--color-depth)]/60">
              To
            </label>
          </div>
          <div className="flex gap-2">
            <div className="w-[140px] flex-shrink-0">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 px-3"
                onClick={() => setShowToTokenModal(true)}
              >
                {toToken ? (
                  <>
                    <TokenLogo symbol={toToken.symbol} name={toToken.name} size="sm" />
                    <span className="truncate">{toToken.symbol}</span>
                  </>
                ) : (
                  "Select"
                )}
              </Button>
            </div>
            <Input
              readOnly
              placeholder="0.00"
              value={estimatedAmount}
              className="flex-1 text-right font-mono text-lg bg-[color:var(--color-depth)]/5"
            />
          </div>
        </div>

        {/* Info / Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm flex gap-2 items-center">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Quote Loading */}
        {isQuoteLoading && (
          <div className="flex justify-center p-2">
            <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-depth)]/40" />
          </div>
        )}

        <Button
          onClick={handleNext}
          className="w-full h-12 text-lg bg-[color:var(--color-accent)]"
          disabled={!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !!error || isQuoteLoading}
        >
          Review Swap
        </Button>
      </div>

      {/* Modals */}
      {showFromTokenModal && (
        <TokenSelectModal
          tokens={userTokenBalances} // Only show user's tokens (and defaults) for "From"
          onSelect={handleFromTokenSelect}
          onClose={() => setShowFromTokenModal(false)}
          chainFilter={null} // Allow picking any chain for FROM
        />
      )}

      {showToTokenModal && (
        <TokenSelectModal
          tokens={tokens}
          onSelect={handleToTokenSelect}
          onClose={() => setShowToTokenModal(false)}
          chainFilter={fromToken ? fromToken.chain : null} // Restrict TO context
        />
      )}

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
