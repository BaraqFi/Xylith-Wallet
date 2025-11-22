"use client";

import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { AiModeAlert } from "@/components/app/AiModeAlert";
import { SplashScreen } from "@/components/app/SplashScreen";
import ManualWallet from "@/components/manual-wallet/ManualWallet";
import { SendFlow } from "@/components/manual-wallet/SendFlow";
import { SwapFlow } from "@/components/manual-wallet/SwapFlow";
import { ReceiveModal } from "@/components/manual-wallet/ReceiveModal";
import { HistoryScreen } from "@/components/manual-wallet/HistoryScreen";
import { TransactionReceipt } from "@/components/manual-wallet/TransactionReceipt";
import { AiModePage } from "@/components/manual-wallet/AiModePage";
import { WalletSettingsModal } from "@/components/manual-wallet/WalletSettingsModal";

function WalletContent() {
  const { mode, currentView } = useApp();

  if (mode === "ai") {
    return <AiModePage />;
  }

  if (currentView === "send") {
    return <SendFlow />;
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

  return <ManualWallet />;
}

function ReceiveModalWrapper() {
  const { currentView } = useApp();
  if (currentView === "receive") {
    return <ReceiveModal />;
  }
  return null;
}

function SettingsModalWrapper() {
  const { currentView } = useApp();
  if (currentView === "settings") {
    return <WalletSettingsModal />;
  }
  return null;
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

function HomeContent() {
  const { darkMode } = useApp();
  const [showSplash, setShowSplash] = useState(true);

  // Initialize dark mode on mount
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, [darkMode]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10">
      <main className="mx-auto w-full">
        <Header />
        <WalletContent />
        <ReceiveModalWrapper />
        <SettingsModalWrapper />
        <AiModeAlert />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}
