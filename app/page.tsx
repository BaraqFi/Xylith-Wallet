"use client";

import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { AiModeAlert } from "@/components/ai/AiModeAlert";
import { SplashScreen } from "@/components/app/SplashScreen";
import ManualWallet from "@/components/wallet/ManualWallet";
import { SendFlow } from "@/components/send/SendFlow";
import { SwapFlow } from "@/components/swap/SwapFlow";
import { ReceiveScreen } from "@/components/receive/ReceiveModal";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { TransactionReceipt } from "@/components/history/TransactionReceipt";
import { AiModePage } from "@/components/ai/AiModePage";
import { WalletSettingsScreen } from "@/components/wallet/WalletSettingsModal";
import { TokenDetailsView } from "@/components/wallet/TokenDetailsView";
import AuthGate from "./AuthGate";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { defaultEvmTokens, defaultSolanaTokens } from "@/components/wallet/data";

function WalletContent() {
  const { mode, currentView, activeChain, selectedTokenDetails } = useApp();

  // Lift useTokenBalances to the common ancestor
  // A more advanced implementation might pass the specific evmChain from context
  const { balances: realBalances, isLoading: isLoadingBalances } = useTokenBalances(
    activeChain,
    'ethereum' // Defaulting to ethereum for the hook
  );

  // FIX: Merge logic to ensure we always have both EVM and Solana tokens available
  // regardless of which chain is "active". This enables the "Send" flow to see all tokens
  // and the "Token List" to show cross-chain holdings (stacked logos).

  const allTokens: any[] = [];

  // 1. Add EVM Tokens (Real or Default)
  if (activeChain === 'EVM') {
    // Preserve the multi-chain structure of defaultEvmTokens, but update balances where found.
    // If realBalances is empty (loading or error), we just use defaults.
    // If realBalances exists (e.g. Ethereum balances), we update the Ethereum entries in default list.
    // AND we must ensure we don't duplicate.

    // Create a map of real balances for O(1) lookup
    // Key: contractAddress-chain (since we might have same contract on diff chains? rare for defaults here)
    // Actually, defaultEvmTokens are distinct by (symbol, evmChain).
    // realBalances currently only returns for 'ethereum' because we pass 'ethereum' to hook.
    // So we match on contractAddress (for same chain) or symbol?
    // Safer: match on contractAddress lowercased if chain matches.

    const balanceMap = new Map<string, any>();
    realBalances.forEach(t => {
      if (t.contractAddress) {
        balanceMap.set(t.contractAddress.toLowerCase(), t);
      }
    });

    // We iterate default tokens (which have all chains: Base, Arb, etc.)
    // If we have a real balance for it, we use the real balance object (which has amount/usdValue).
    // If not, we keep the default (amount=0).
    const mergedEvmTokens = defaultEvmTokens.map(defToken => {
      // Only update if the real balance corresponds to this default token
      // check contract address match
      const match = balanceMap.get(defToken.contractAddress?.toLowerCase() || "");
      // CRITICAL FIX: Ensure the matched real token is for the SAME chain as the default token.
      // Native tokens (ETH, BNB) often share '0x00...00' address across different chains.
      if (match && match.evmChain === defToken.evmChain) {
        // Found a real balance update. Use it.
        return match;
      }
      return defToken;
    });

    allTokens.push(...mergedEvmTokens);

    // Also push any "new" tokens found in realBalances that weren't in default list?
    // (e.g. if user has some random ERC20 not in default list)
    realBalances.forEach(t => {
      const isDefault = defaultEvmTokens.some(d => d.contractAddress?.toLowerCase() === t.contractAddress?.toLowerCase());
      if (!isDefault) {
        allTokens.push(t);
      }
    });

  } else {
    // If not active, use defaults
    allTokens.push(...defaultEvmTokens);
  }

  // 2. Add Solana Tokens (Default only for now as we don't have a Solana hook hooked up yet)
  // If activeChain is Solana, useTokenBalances might be returning Solana tokens if implemented?
  // Previous logic suggested useTokenBalances only handles EVM for now ('ethereum' hardcoded).
  // So we just push defaultSolanaTokens.
  allTokens.push(...defaultSolanaTokens);

  if (mode === "ai") {
    return <AiModePage />;
  }
  if (currentView === "token-details") {
    if (selectedTokenDetails) {
      return <TokenDetailsView token={selectedTokenDetails} allTokens={allTokens} />;
    }
  }
  if (currentView === "send") {
    // Pass ALL tokens to SendFlow so it can filter by chain
    return <SendFlow tokens={allTokens} />;
  }
  if (currentView === "swap") {
    return <SwapFlow />;
  }
  if (currentView === "history") {
    return <HistoryScreen />;
  }
  if (currentView === "receipt") {
    return <TransactionReceipt />;
  }
  // Pass ALL tokens to ManualWallet so it can group them (e.g. USDC on both chains)
  return <ManualWallet tokens={allTokens} isLoading={isLoadingBalances} />;
}

function ReceiveScreenWrapper() {
  const { currentView } = useApp();
  return currentView === "receive" ? <ReceiveScreen /> : null;
}

function SettingsScreenWrapper() {
  const { currentView } = useApp();
  return currentView === "settings" ? <WalletSettingsScreen /> : null;
}

function Header() {
  const { currentView } = useApp();
  const showToggles = currentView === "wallet";
  if (!showToggles) return null;
  return (
    <div className="mb-6 flex items-center justify-end">
      <div className="flex items-center gap-3">
        <ModeToggle />
      </div>
    </div>
  );
}

function BodyScrollManager() {
  const { currentView } = useApp();

  useEffect(() => {
    const isModalOpen = currentView === 'receive' || currentView === 'settings';
    if (isModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [currentView]);

  return null;
}

function HomeContent() {
  return (
    <AuthGate>
      <div className="min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10">
        <main className="mx-auto w-full">
          <Header />
          <WalletContent />
          <ReceiveScreenWrapper />
          <SettingsScreenWrapper />
          <AiModeAlert />
        </main>
      </div>
    </AuthGate>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <BodyScrollManager />
      <HomeContent />
    </AppProvider>
  );
}
