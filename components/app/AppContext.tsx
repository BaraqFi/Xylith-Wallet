"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { TokenBalance } from "@/components/manual-wallet/data";

export type WalletMode = "manual" | "ai";

interface AppState {
  mode: WalletMode;
  setMode: (mode: WalletMode) => void;
  showAiAlert: boolean;
  setShowAiAlert: (show: boolean) => void;
  dontShowAiAlert: boolean;
  setDontShowAiAlert: (dont: boolean) => void;
  currentView: "wallet" | "send" | "receive" | "history" | "receipt" | "swap";
  setCurrentView: (view: AppState["currentView"]) => void;
  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  preselectedToken: TokenBalance | null;
  setPreselectedToken: (token: TokenBalance | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("manual");
  const [showAiAlert, setShowAiAlert] = useState(false);
  const [dontShowAiAlert, setDontShowAiAlert] = useState(false);
  const [currentView, setCurrentView] = useState<AppState["currentView"]>("wallet");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [preselectedToken, setPreselectedToken] = useState<TokenBalance | null>(null);

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
        selectedTransactionId,
        setSelectedTransactionId,
        darkMode,
        setDarkMode,
        preselectedToken,
        setPreselectedToken,
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

