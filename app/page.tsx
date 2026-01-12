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
import AuthGate from "./AuthGate";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { defaultEvmTokens, defaultSolanaTokens } from "@/components/wallet/data";

function WalletContent() {
  const { mode, currentView, activeChain } = useApp();
  
  // Lift useTokenBalances to the common ancestor
  // A more advanced implementation might pass the specific evmChain from context
  const { balances: realBalances, isLoading: isLoadingBalances } = useTokenBalances(
    activeChain,
    'ethereum' // Defaulting to ethereum for the hook
  );
  
  // Create a default list based on the active chain
  const defaultTokens = activeChain === 'EVM' ? defaultEvmTokens : defaultSolanaTokens;
  
  // Use real balances if available, otherwise use the default list as a fallback
  const displayTokens = realBalances.length > 0 ? realBalances : defaultTokens;

  if (mode === "ai") {
    return <AiModePage />;
  }
  if (currentView === "send") {
    // Pass live balances to SendFlow
    return <SendFlow tokens={displayTokens} />;
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
  // Pass live balances and loading state to ManualWallet
  return <ManualWallet tokens={displayTokens} isLoading={isLoadingBalances} />;
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
