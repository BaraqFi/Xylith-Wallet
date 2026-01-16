"use client";

import { useState, useEffect } from "react";
import { useApp } from "../app/AppContext";
import { TokenBalance, SUPPORTED_CHAINS } from "../wallet/data";
import { ChainLogo } from "../wallet/ChainLogo";
import { TokenLogo } from "../wallet/ManualWallet";
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
import { Chain, EVMChain } from "../wallet/data"; // Ensure Chain type is imported
import { useSolanaTokenList } from "@/hooks/useSolanaTokenList";

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

  const { user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();

  // Determine active chain context
  // We use the selected chain states for driving fetching
  const activeChainForBalances = selectedChain;
  // If selected chain is EVM, use the specific EVM chain. Fallback to ethereum if undefined (shouldn't happen if logic is correct)
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

  // Helper to get total value per chain
  const getChainTotalValue = (chainLabel: string, chainType: "EVM" | "Solana", chainValue: string | EVMChain) => {
    return userTokenBalances
      .filter(t => {
        if (chainType === "Solana") return t.chain === "Solana";
        return t.chain === "EVM" && t.evmChain === chainValue;
      })
      .reduce((sum, t) => sum + (t.usdValue || 0), 0);
  };

  // Filter tokens strictly by the selected chain to ensure the modal only shows relevant tokens
  const filteredTokensForChain = tokens.filter(t => {
    if (selectedChain === 'Solana') return t.chain === 'Solana';
    if (selectedChain === 'EVM') return t.chain === 'EVM' && t.evmChain === selectedEvmChain;
    return false;
  });

  // Strict "From" token list: Only tokens with balance > 0
  const fromTokenList = filteredTokensForChain.filter(t => t.amount > 0);

  // "To" token list:
  // EVM: Use cached 1inch list (filteredTokensForChain is already heavily populated for EVM)
  // Solana: Use Jupiter Strict List
  const toTokenList = selectedChain === 'Solana' ? solanaTokenList : filteredTokensForChain;

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

    // No need to reset chain state here as the modal is already filtered by current chain state

    // Reset ToToken if chain compatibility issue (should be guarded by filtering anyway)
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
    if (selectedChain === 'Solana') return "~0.000005 SOL"; // Typical Solana gas
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

  // Helper to get current chain label/logo
  const getCurrentChainOption = () => {
    if (selectedChain === 'Solana') return SUPPORTED_CHAINS.find(c => c.value === 'solana');
    return SUPPORTED_CHAINS.find(c => c.value === selectedEvmChain);
  };
  const currentChainOption = getCurrentChainOption();

  const renderHeader = (title: string) => (
    <div className="mb-6 flex items-center justify-between">
      {/* Chain Selector (Top Center/Left) */}
      {title === "Swap" ? (
        <div className="flex items-center gap-2">
          <ChainSelectorSheet
            selectedChain={selectedChain}
            selectedEvmChain={selectedEvmChain}
            tokens={userTokenBalances}
            onSelectChain={(chain, evmChain) => handleChainChange(chain, evmChain as EVMChain)}
            trigger={
              <Button variant="outline" className="h-9 gap-2 rounded-full px-3 border-[color:var(--color-border)] bg-transparent hover:bg-[color:var(--color-depth)]/5">
                <ChainLogo chain={selectedEvmChain || (selectedChain === 'Solana' ? 'solana' : 'ethereum')} />
                <span className="text-sm font-medium">{currentChainOption?.label || "Select Chain"}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            }
          />
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
          tokens={fromTokenList}
          onSelect={handleFromTokenSelect}
          onClose={() => setShowFromTokenModal(false)}
          chain={selectedEvmChain}
          chainFilter={selectedChain}
        />
      )}

      {showToTokenModal && (
        <TokenSelectModal
          tokens={toTokenList}
          onSelect={handleToTokenSelect}
          onClose={() => setShowToTokenModal(false)}
          chain={selectedEvmChain}
          chainFilter={selectedChain}
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
