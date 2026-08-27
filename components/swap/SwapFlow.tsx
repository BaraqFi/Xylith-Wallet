"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance, SUPPORTED_CHAINS, isNativeTokenAddress } from "../wallet/data";
import { ChainLogo } from "../wallet/ChainLogo";
import { TokenLogo } from "../wallet/TokenLogo";
import { ChainSelectorSheet } from "../wallet/ChainSelectorSheet";
import { TokenSelectModal } from "../wallet/TokenSelectModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Check,
  X,
  Loader2,
  ArrowLeft,
  ArrowUpDown,
  Settings,
  ChevronDown,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
// Solana wallets are NOT in the main useWallets() (Ethereum-only); they come
// from the dedicated solana entrypoint.
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { pickSolanaWallet, signSolanaTransactionBytes } from "@/lib/solana/privyWallet";
import { formatUnits, parseUnits, encodeFunctionData, parseAbi } from "viem";
import { Buffer } from "buffer";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useSwapQuote } from "@/hooks/useSwapQuote";
import { useSolanaSwapQuote } from "@/hooks/useSolanaSwapQuote";
import { useAllowance } from "@/hooks/useAllowance";
import { OneInchClient } from "@/lib/1inch/client";
import { useSwapTokenList } from "@/hooks/useSwapTokenList";
import { useSwapSecurity, useTokenSecurity } from "@/hooks/useSecurityCheck";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { ultraClient } from "@/lib/ultra/client";
import { Chain, EVMChain } from "../wallet/data"; // Ensure Chain type is imported
import { useSolanaTokenList } from "@/hooks/useSolanaTokenList";
import { useSolanaShield } from "@/hooks/useSolanaShield";

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



export function SwapFlow({
  onTransactionSettled,
}: {
  /** Refresh balances once a swap lands, so the wallet isn't stale. */
  onTransactionSettled?: () => void;
} = {}) {
  const { setCurrentView, preselectedToken, setPreselectedToken, slippage, setSlippage, activeChain: appActiveChain } = useApp();

  // Initialize selectedChain based on preselectedToken or appActiveChain
  // Helper to resolve initial state
  const getInitialChain = (): { chain: Chain; evmChain?: EVMChain } => {
    if (preselectedToken) {
      return {
        chain: preselectedToken.chain,
        evmChain: preselectedToken.evmChain
      };
    }
    // Default to app active chain context
    if (appActiveChain === "Solana") {
      return { chain: "Solana" };
    }
    // Default to Ethereum for EVM if no specific chain is set in context (context only has "EVM")
    return { chain: "EVM", evmChain: "ethereum" };
  };

  const initialChainState = getInitialChain();
  const [selectedChain, setSelectedChain] = useState<Chain>(initialChainState.chain);
  const [selectedEvmChain, setSelectedEvmChain] = useState<EVMChain | undefined>(initialChainState.evmChain);

  const [step, setStep] = useState<SwapStep>("form");
  const [fromToken, setFromToken] = useState<TokenBalance | null>(
    preselectedToken
  );
  const [toToken, setToToken] = useState<TokenBalance | null>(null);
  const [fromTokenChain, setFromTokenChain] = useState<string | null>(initialChainState.evmChain
    ? `${initialChainState.chain}-${initialChainState.evmChain}`
    : initialChainState.chain
  );
  const [toTokenChain, setToTokenChain] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [error, setError] = useState("");
  const [showFromTokenModal, setShowFromTokenModal] = useState(false);
  const [showToTokenModal, setShowToTokenModal] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [percentage, setPercentage] = useState(0);

  // Search state persistence
  const [fromSearchQuery, setFromSearchQuery] = useState("");
  const [toSearchQuery, setToSearchQuery] = useState("");
  const [fromRemoteResults, setFromRemoteResults] = useState<TokenBalance[]>([]); // Added for persistence
  const [toRemoteResults, setToRemoteResults] = useState<TokenBalance[]>([]);     // Added for persistence

  const { user, sendTransaction } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  // Determine active chain context
  const activeChainForBalances = selectedChain;
  const activeEvmChainForBalances = selectedChain === "EVM" ? (selectedEvmChain || "ethereum") : "ethereum";

  const { balances: userTokenBalances } = useTokenBalances(activeChainForBalances, activeEvmChainForBalances);

  // Get comprehensive token list from 1inch (only for EVM chains to supplement)
  const { tokens: swapTokenList, isLoading: isLoadingTokenList } = useSwapTokenList(
    activeEvmChainForBalances,
    userTokenBalances
  );

  // If Solana, we mainly rely on user balances + default list for now (handled in hook)
  // If EVM, use swap token list
  const tokens = activeChainForBalances === "EVM" && swapTokenList.length > 0
    ? swapTokenList
    : userTokenBalances;

  // Fetch Jupiter Strict List for Solana "To" selection
  const { tokens: solanaTokenList } = useSolanaTokenList();

  // Filter tokens strictly by the selected chain
  const filteredTokensForChain = tokens.filter(t => {
    if (selectedChain === 'Solana') return t.chain === 'Solana';
    if (selectedChain === 'EVM') return t.chain === 'EVM' && t.evmChain === selectedEvmChain;
    return false;
  });

  // Strict "From" token list: Only tokens with balance > 0
  const fromTokenList = filteredTokensForChain.filter(t => t.amount > 0);

  // "To" token list:
  const toTokenList = selectedChain === 'Solana' ? solanaTokenList : filteredTokensForChain;

  // Solana Shield warnings for selected tokens (primary for Solana)
  // Memoize to prevent infinite re-renders due to new array reference on every render
  const solanaTokensForShield = useMemo(() => {
    return selectedChain === 'Solana'
      ? [fromToken, toToken].filter((t): t is TokenBalance => !!t && t.chain === 'Solana')
      : [];
  }, [selectedChain, fromToken, toToken]);

  const { warnings: solanaShieldWarnings } = useSolanaShield(solanaTokensForShield, solanaTokensForShield.length > 0);

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
  const solanaWallet = pickSolanaWallet(solanaWallets);
  const solanaAddress = solanaWallet?.address;

  const {
    quote: solQuote,
    swapTx: solSwapTx,
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
        // Jupiter quote
        const outAmount = quote.outAmount || quote.dstAmount;
        const decimals = toToken.decimals || 6;
        if (outAmount) {
          const val = formatUnits(BigInt(outAmount), decimals);
          setEstimatedAmount(val);
        }
      } else {
        // 1inch quote
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

  // Compare allowance in base units — `allowance` is raw wei, so the swap
  // amount must be scaled by the token's decimals before comparing.
  // Natives never need approval (useAllowance short-circuits them to max).
  const requiredAllowanceWei = useMemo(() => {
    if (!fromToken || !amount) return BigInt(0);
    try {
      return parseUnits(amount, fromToken.decimals ?? 18);
    } catch {
      return BigInt(0);
    }
  }, [fromToken, amount]);
  const needsApproval = !isSolanaSwap && allowance < requiredAllowanceWei;

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

  const handleChainChange = (chainType: "EVM" | "Solana", evmChain?: EVMChain) => {
    setSelectedChain(chainType);
    if (evmChain) {
      setSelectedEvmChain(evmChain);
    } else {
      setSelectedEvmChain(undefined);
    }

    // Clear tokens if they don't match the new chain
    // We check if the fromToken matches the new chain. If NOT, clear it.
    if (fromToken) {
      const isSameChain = fromToken.chain === chainType && (!evmChain || fromToken.evmChain === evmChain);
      if (!isSameChain) {
        setFromToken(null);
        setFromTokenChain(null);
        setAmount(""); // Reset amount on chain switch
      }
    }

    // Always clear ToToken on chain switch to prevent mismatch (unless we implement cross-chain later)
    setToToken(null);
    setToTokenChain(null);
    setEstimatedAmount("");
    setPercentage(0);
    setError("");
  };

  const handleFromTokenSelect = (token: TokenBalance) => {
    setFromToken(token);
    const chainKey = token.evmChain
      ? `${token.chain}-${token.evmChain}`
      : token.chain;
    setFromTokenChain(chainKey);

    // Filter destination if needed, but we rely on modal for that
    if (toToken && (toToken.chain !== token.chain || toToken.evmChain !== token.evmChain)) {
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
      setError("Cross-chain swaps are not currently supported");
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
      setError("Unable to fetch a quote. The pair might have low liquidity or API limits.");
      return;
    }
    setError("");
    setStep("confirm");
  };

  // EVM Approval
  const [isApproving, setIsApproving] = useState(false);
  const handleApprove = async () => {
    if (!fromToken || !fromToken.contractAddress || isSolanaSwap) return;
    if (isNativeTokenAddress(fromToken.contractAddress)) return;

    setIsApproving(true);
    try {
      const amountWei = parseUnits(amount, fromToken.decimals || 18);
      const data = encodeFunctionData({
        abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
        functionName: 'approve',
        args: [AGGREGATION_ROUTER_V6, amountWei]
      });

      await sendTransaction({
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
        if (!solanaWallet) throw new Error("Solana wallet not connected");
        const txBase64 = await fetchSolSwap();
        if (!txBase64) throw new Error("Failed to prepare Solana transaction");
        // Ultra returns a fully-built (versioned) transaction; wallet-standard
        // signing takes the raw bytes as-is — no deserialization needed.
        const txBytes = new Uint8Array(Buffer.from(txBase64, 'base64'));
        const signedBytes = await signSolanaTransactionBytes(solanaWallet, txBytes);
        const signedTxBase64 = Buffer.from(signedBytes).toString('base64');

        const requestId = (solQuote as any)?.requestId;
        if (!requestId || typeof requestId !== "string") {
          throw new Error("Missing Ultra requestId for swap execution");
        }

        const executeResponse = await ultraClient.executeOrder({
          signedTransaction: signedTxBase64,
          requestId,
        });

        console.log("Solana Ultra Swap Executed:", executeResponse?.signature || executeResponse);
        setStep("success");
        onTransactionSettled?.();
      } else {
        const txData = await fetchEvmSwap();
        if (!txData || !txData.tx) throw new Error("Failed to prepare transaction");
        const { hash } = await sendTransaction({
          to: txData.tx.to,
          data: txData.tx.data,
          value: BigInt(txData.tx.value),
          chainId: getChainId(fromToken),
        });
        console.log("EVM Swap Executed:", hash);
        setStep("success");
        onTransactionSettled?.();
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

  // Search Handler for both Solana and EVM Tokens
  const handleSearch = useCallback(async (query: string, setResultsState?: (results: TokenBalance[]) => void): Promise<TokenBalance[]> => {
    if (!query || query.trim().length < 2) {
      setResultsState?.([]); // Clear results if query is too short
      return [];
    }

    try {
      let results: TokenBalance[] = [];
      if (selectedChain === 'Solana') {
        // Solana search via Jupiter, with Ultra as fallback
        try {
          const res = await fetch(`/api/jupiter/tokens?query=${encodeURIComponent(query)}`);
          if (!res.ok) {
            throw new Error("Search failed");
          }
          const data = await res.json();
          results = data.map((t: { symbol: string; name: string; address: string; decimals: number; logoURI: string; }) => ({
            symbol: t.symbol,
            name: t.name,
            chain: "Solana",
            amount: 0,
            usdValue: 0,
            contractAddress: t.address,
            decimals: t.decimals,
            logo: t.logoURI,
          }));
        } catch {
          const res = await fetch(`/api/ultra/search?query=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json();
          results = data.map((t: { symbol: string; name: string; address: string; decimals: number; logoURI: string; }) => ({
            symbol: t.symbol,
            name: t.name,
            chain: "Solana",
            amount: 0,
            usdValue: 0,
            contractAddress: t.address,
            decimals: t.decimals,
            logo: t.logoURI,
          }));
        }
      } else if (selectedChain === 'EVM' && selectedEvmChain) {
        // EVM search via Moralis (with CoinGecko fallback)
        const res = await fetch(
          `/api/evm/search?query=${encodeURIComponent(query)}&chain=${selectedEvmChain}`
        );
        if (!res.ok) {
          // If error response, try to parse error or return empty
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Search failed");
        }
        const data = await res.json();
        // Ensure results match TokenBalance format
        results = data.map((t: { symbol: string; name: string; evmChain?: string; amount?: number; usdValue?: number; contractAddress: string; decimals?: number; logo?: string; }) => ({
          symbol: t.symbol,
          name: t.name,
          chain: "EVM",
          evmChain: selectedEvmChain,
          amount: t.amount || 0,
          usdValue: t.usdValue || 0,
          contractAddress: t.contractAddress,
          decimals: t.decimals || 18,
          logo: t.logo,
        }));
      }
      setResultsState?.(results); // Update parent's state
      return results;
    } catch (err) {
      console.error("Token search failed", err);
      setResultsState?.([]); // Clear results on error
      return [];
    }
  }, [selectedChain, selectedEvmChain]);

  const handleFromSearch = useCallback(async (query: string): Promise<TokenBalance[]> => {
    return handleSearch(query, setFromRemoteResults);
  }, [handleSearch]);

  const handleToSearch = useCallback(async (query: string): Promise<TokenBalance[]> => {
    return handleSearch(query, setToRemoteResults);
  }, [handleSearch]);

  const getChainLabel = (token: TokenBalance) => {
    if (token.evmChain) {
      return (
        token.evmChain.charAt(0).toUpperCase() + token.evmChain.slice(1)
      );
    }
    return "Solana";
  };

  const formatGasEstimate = () => {
    if (selectedChain === 'Solana') return "~0.000005 SOL";
    if (evmQuote?.gas && evmQuote?.gasPrice) {
      const gasInGwei = BigInt(evmQuote.gasPrice) / BigInt(1e9);
      const gasCost = (Number(evmQuote.gas) * Number(gasInGwei)) / 1e9;
      return `~${gasCost.toFixed(4)} ETH`;
    }
    return "~$5-10";
  };
  const gasEstimate = formatGasEstimate();
  const timeEstimate = selectedChain === 'Solana' ? "< 1 min" : "1-3 min";
  const routeLabel = selectedChain === 'Solana' ? "Jupiter" : "1inch";

  const getCurrentChainOption = () => {
    if (selectedChain === 'Solana') return SUPPORTED_CHAINS.find(c => c.value === 'solana');
    return SUPPORTED_CHAINS.find(c => c.value === selectedEvmChain);
  };
  const currentChainOption = getCurrentChainOption();

  const renderHeader = (title: string) => (
    <div className="mb-6 flex items-center justify-between">
      {title === "Swap" ? (
        <div className="flex items-center gap-2">
          {selectedChain === 'EVM' ? (
            <ChainSelectorSheet
              selectedChain={selectedChain}
              selectedEvmChain={selectedEvmChain}
              tokens={userTokenBalances}
              onSelectChain={(chain, evmChain) => handleChainChange(chain, evmChain as EVMChain)}
              trigger={
                <Button variant="outline" className="h-9 gap-2 rounded-full px-3 border-[color:var(--color-border)] bg-transparent hover:bg-[color:var(--color-depth)]/5">
                  <ChainLogo chain={selectedEvmChain || 'ethereum'} />
                  <span className="text-sm font-medium">{currentChainOption?.label || "Select Chain"}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              }
            />
          ) : (
            // For Solana, just show generic label or switch back to EVM if needed
            <ChainSelectorSheet
              selectedChain={selectedChain}
              selectedEvmChain={selectedEvmChain}
              tokens={userTokenBalances}
              onSelectChain={(chain, evmChain) => handleChainChange(chain, evmChain as EVMChain)}
              trigger={
                <Button variant="outline" className="h-9 gap-2 rounded-full px-3 border-[color:var(--color-border)] bg-transparent hover:bg-[color:var(--color-depth)]/5">
                  <ChainLogo chain="solana" />
                  <span className="text-sm font-medium">Solana</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">
          {title}
        </h2>
      )}

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
            Executing swap on {selectedChain === "Solana" ? "Solana" : "EVM"}
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
              <p className="font-semibold">{amount} {fromToken?.symbol}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[color:var(--color-depth)]/60">Received</p>
              <p className="font-semibold">{estimatedAmount} {toToken?.symbol}</p>
            </div>
          </div>
          <Button onClick={handleClose} className="mt-4 w-full">Done</Button>
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
          <p className="text-lg font-semibold text-[color:var(--color-depth)]">Swap not completed</p>
          <p className="text-sm text-center text-[color:var(--color-depth)]/60 px-4">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setStep("form")}>Try Again</Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="wallet-card p-8">
        {renderHeader("Confirm Swap")}
        <div className="space-y-4">
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-5 rounded-[2rem]">
            <p className="mb-3 text-xs font-bold text-[color:var(--color-depth)]/40 uppercase tracking-widest">From</p>
            <div className="flex items-center gap-3">
              <TokenLogo symbol={fromToken!.symbol} name={fromToken!.name} size="sm" src={fromToken!.logo} />
              <div className="flex-1">
                <p className="font-semibold">{fromToken!.name}</p>
                <p className="text-xs text-[color:var(--color-depth)]/60">{getChainLabel(fromToken!)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{amount} {fromToken!.symbol}</p>
              </div>
            </div>
            {isSolanaSwap && fromToken?.contractAddress && solanaShieldWarnings[fromToken.contractAddress]?.length > 0 && (
              <div className="mt-3 space-y-1">
                {solanaShieldWarnings[fromToken.contractAddress].map((w, idx) => (
                  <div
                    key={`${fromToken.contractAddress}-from-${idx}`}
                    className="flex items-start gap-2 text-xs text-[color:var(--color-depth)]/80"
                  >
                    <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <ArrowUpDown className="h-6 w-6 text-[color:var(--color-depth)]/60" />
          </div>

          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-5 rounded-[2rem]">
            <p className="mb-3 text-xs font-bold text-[color:var(--color-depth)]/40 uppercase tracking-widest">To</p>
            <div className="flex items-center gap-3">
              <TokenLogo symbol={toToken!.symbol} name={toToken!.name} size="sm" src={toToken!.logo} />
              <div className="flex-1">
                <p className="font-semibold">{toToken!.name}</p>
                <p className="text-xs text-[color:var(--color-depth)]/60">{getChainLabel(toToken!)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{estimatedAmount} {toToken!.symbol}</p>
              </div>
            </div>
            {isSolanaSwap && toToken?.contractAddress && solanaShieldWarnings[toToken.contractAddress]?.length > 0 && (
              <div className="mt-3 space-y-1">
                {solanaShieldWarnings[toToken.contractAddress].map((w, idx) => (
                  <div
                    key={`${toToken.contractAddress}-to-${idx}`}
                    className="flex items-start gap-2 text-xs text-[color:var(--color-depth)]/80"
                  >
                    <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {needsApproval ? (
              <Button onClick={handleApprove} className="w-full bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/90 text-white rounded-[1.5rem] py-6 text-base font-bold uppercase tracking-wider" disabled={isApproving}>
                {isApproving ? "Approving..." : `Approve ${fromToken?.symbol}`}
              </Button>
            ) : (
              <Button onClick={handleConfirm} className="w-full bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/90 text-white rounded-[1.5rem] py-6 text-base font-bold uppercase tracking-wider">Confirm Swap</Button>
            )}
            <Button variant="ghost" onClick={() => setStep("form")} className="w-full">Back</Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Form Render ---
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto relative px-2 sm:px-0">
      {renderHeader("Swap")}

      <div className="relative flex flex-col gap-2">
        {/* FROM Card */}
        <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-5 rounded-[2rem] relative z-10 transition-all focus-within:border-[color:var(--color-accent)]/30">
          <div className="flex justify-between mb-3">
            <span className="text-xs font-bold text-[color:var(--color-depth)]/40 uppercase tracking-widest">You Pay</span>
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-depth)]/40 font-bold">
              Wallet: {realFromTokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-4xl font-semibold outline-none w-full border-none p-0 focus-visible:ring-0 placeholder:text-[color:var(--color-depth)]/10 h-auto focus-visible:border-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              onClick={() => setShowFromTokenModal(true)}
              className="flex items-center gap-2 bg-[color:var(--color-depth)]/5 hover:bg-[color:var(--color-depth)]/10 py-2 pl-2 pr-4 rounded-full border border-[color:var(--color-depth)]/5 transition-all min-w-[120px]"
            >
              {fromToken ? (
                <>
                  <TokenLogo symbol={fromToken.symbol} name={fromToken.name} size="xs" src={fromToken.logo} />
                  <span className="font-bold text-sm truncate max-w-[60px]">{fromToken.symbol}</span>
                </>
              ) : (
                <span className="font-bold text-sm ml-2">Select</span>
              )}
              <ChevronDown size={14} className="opacity-40 ml-auto" />
            </button>
          </div>

          {/* Percentage Quick Select - Optional but nice to keep */}
          {realFromTokenBalance > 0 && (
            <div className="flex gap-2 mt-4">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePercentageChange(pct)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors border ${percentage === pct ? 'bg-[color:var(--color-accent)]/10 border-[color:var(--color-accent)]/30 text-[color:var(--color-accent)]' : 'border-transparent bg-[color:var(--color-depth)]/5 text-[color:var(--color-depth)]/40'}`}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Flip Button - Centered between cards */}
        <div className="relative flex items-center justify-center -my-2 z-20">
          <button
            onClick={handleSwapTokens}
            className="w-10 h-10 bg-[color:var(--color-surface)] border-4 border-[color:var(--color-background)] rounded-xl flex items-center justify-center text-[color:var(--color-depth)]/40 hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-background)] shadow-lg transition-all"
          >
            <ArrowUpDown size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* TO Card */}
        <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-5 rounded-[2rem] relative z-10 transition-all focus-within:border-[color:var(--color-accent)]/30">
          <div className="flex justify-between mb-3">
            <span className="text-xs font-bold text-[color:var(--color-depth)]/40 uppercase tracking-widest">You Receive</span>
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-depth)]/40 font-bold">
              Wallet: {toToken ? (getRealBalance(toToken) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Input
              type="text"
              readOnly
              value={estimatedAmount}
              placeholder="0.00"
              className="bg-transparent text-4xl font-semibold outline-none w-full border-none p-0 focus-visible:ring-0 placeholder:text-[color:var(--color-depth)]/10 h-auto text-[color:var(--color-depth)]/50"
            />
            <button
              onClick={() => setShowToTokenModal(true)}
              className="flex items-center gap-2 bg-[color:var(--color-depth)]/5 hover:bg-[color:var(--color-depth)]/10 py-2 pl-2 pr-4 rounded-full border border-[color:var(--color-depth)]/5 transition-all min-w-[120px]"
            >
              {toToken ? (
                <>
                  <TokenLogo symbol={toToken.symbol} name={toToken.name} size="xs" src={toToken.logo} />
                  <span className="font-bold text-sm truncate max-w-[60px]">{toToken.symbol}</span>
                </>
              ) : (
                <span className="font-bold text-sm ml-2">Select</span>
              )}
              <ChevronDown size={14} className="opacity-40 ml-auto" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-[color:var(--color-depth)]/30 font-medium px-1">
            <span>{quoteError ? 'No route found' : (estimatedAmount ? `≈ ${timeEstimate}` : 'Enter amount')}</span>
            <span>{gasEstimate} gas</span>
          </div>
        </div>

        {/* Error Banners */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 p-4 rounded-2xl flex items-start gap-3 mt-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Swap Action Button */}
        <Button
          onClick={handleNext}
          disabled={!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !!quoteError}
          className="w-full py-6 mt-2 rounded-[1.5rem] text-base font-bold uppercase tracking-wider bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/90 text-white shadow-lg shadow-[color:var(--color-accent)]/20"
        >
          {!fromToken || !toToken ? (
            "Select Tokens"
          ) : !amount ? (
            "Enter Amount"
          ) : quoteError ? (
            "Route Unavailable"
          ) : (
            "Review Swap"
          )}
        </Button>

      </div>

      {showSlippageSettings && (
        <Dialog open={showSlippageSettings} onOpenChange={setShowSlippageSettings}>
          <SlippageSettings
            slippage={slippage}
            onSlippageChange={setSlippage}
            onClose={() => setShowSlippageSettings(false)}
          />
        </Dialog>
      )}

      {showFromTokenModal && (
        <TokenSelectModal
          tokens={fromTokenList}
          onSelect={handleFromTokenSelect}
          onClose={() => setShowFromTokenModal(false)}
          chainFilter={selectedChain === "EVM" ? "EVM" : "Solana"} // Strict source chain filtering
          chain={selectedEvmChain}
          onSearch={handleFromSearch} // Use new wrapper function
          selectedToken={fromToken}
          selectMode="from"
          initialSearchQuery={fromSearchQuery}
          onQueryChange={setFromSearchQuery}
          initialRemoteResults={fromRemoteResults} // Pass initial remote results
        />
      )}

      {showToTokenModal && (
        <TokenSelectModal
          tokens={toTokenList}
          onSelect={handleToTokenSelect}
          onClose={() => setShowToTokenModal(false)}
          // Destination can be cross-chain theoretically but stick to strict for now
          chainFilter={selectedChain === "EVM" ? "EVM" : "Solana"}
          chain={selectedEvmChain}
          excludeSymbol={fromToken?.symbol}
          onSearch={handleToSearch} // Use new wrapper function
          selectedToken={toToken}
          selectMode="to"
          initialSearchQuery={toSearchQuery}
          onQueryChange={setToSearchQuery}
          initialRemoteResults={toRemoteResults} // Pass initial remote results
        />
      )}
    </div>
  );
}
