"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { TokenBalance, Chain, WalletTransaction } from "@/components/wallet/data";

export type WalletMode = "manual" | "ai";

interface AppState {
  mode: WalletMode;
  setMode: (mode: WalletMode) => void;
  showAiAlert: boolean;
  setShowAiAlert: (show: boolean) => void;
  dontShowAiAlert: boolean;
  setDontShowAiAlert: (dont: boolean) => void;
  currentView: "wallet" | "send" | "receive" | "history" | "receipt" | "swap" | "settings" | "token-details";
  setCurrentView: (view: AppState["currentView"]) => void;
  selectedTokenDetails: TokenBalance | null;
  setSelectedTokenDetails: (token: TokenBalance | null) => void;
  // The full transaction object, not an id: history is fetched per-screen by
  // useTransactionHistory, so there is no shared list a receipt could resolve
  // an id against later.
  selectedTransaction: WalletTransaction | null;
  setSelectedTransaction: (tx: WalletTransaction | null) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  preselectedToken: TokenBalance | null;
  setPreselectedToken: (token: TokenBalance | null) => void;
  slippage: number;
  setSlippage: (slippage: number) => void;
  activeChain: Chain;
  setActiveChain: (chain: Chain) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("manual");
  const [showAiAlert, setShowAiAlert] = useState(false);
  const [dontShowAiAlert, setDontShowAiAlert] = useState(false);
  const [currentView, setCurrentView] = useState<AppState["currentView"]>("wallet");
  const [selectedTokenDetails, setSelectedTokenDetails] = useState<TokenBalance | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [preselectedToken, setPreselectedToken] = useState<TokenBalance | null>(null);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [activeChain, setActiveChain] = useState<Chain>("EVM");

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        showAiAlert,
        setShowAiAlert,
        dontShowAiAlert,
        setDontShowAiAlert,
        currentView,
        setCurrentView,
        selectedTransaction,
        setSelectedTransaction,
        darkMode,
        setDarkMode,
        preselectedToken,
        setPreselectedToken,
        slippage,
        setSlippage,
        activeChain,
        setActiveChain,
        selectedTokenDetails,
        setSelectedTokenDetails,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

