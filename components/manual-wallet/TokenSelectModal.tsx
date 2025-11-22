"use client";

import { useState, useMemo } from "react";
import { TokenBalance } from "./data";
import { TokenLogo } from "./ManualWallet";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TokenSelectModalProps {
  tokens: TokenBalance[];
  onSelect: (token: TokenBalance) => void;
  onClose: () => void;
  excludeSymbol?: string;
}

export function TokenSelectModal({
  tokens,
  onSelect,
  onClose,
  excludeSymbol,
}: TokenSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Group tokens by symbol
  const groupedTokens = useMemo(() => {
    return tokens.reduce((acc, token) => {
      const key = token.symbol;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(token);
      return acc;
    }, {} as Record<string, TokenBalance[]>);
  }, [tokens]);

  // Filter and search
  const filteredTokens = useMemo(() => {
    const symbols = Object.keys(groupedTokens).filter((symbol) => {
      if (excludeSymbol && symbol === excludeSymbol) return false;
      const tokens = groupedTokens[symbol];
      const firstToken = tokens[0];
      return (
        symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        firstToken.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
    return symbols.map((symbol) => groupedTokens[symbol]);
  }, [groupedTokens, searchQuery, excludeSymbol]);

  const handleTokenClick = (tokens: TokenBalance[]) => {
    // Select the token with highest value
    const bestToken = tokens.reduce((best, current) =>
      current.usdValue > best.usdValue ? current : best
    );
    onSelect(bestToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4">
      <div className="wallet-card w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[color:var(--color-border)]">
          <button
            onClick={onClose}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-[color:var(--color-depth)]">
            Select Token
          </h2>
          <div className="w-5" /> {/* Spacer for centering */}
        </div>

        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((tokenGroup) => {
              const totalAmount = tokenGroup.reduce((sum, t) => sum + t.amount, 0);
              const totalValue = tokenGroup.reduce((sum, t) => sum + t.usdValue, 0);
              const firstToken = tokenGroup[0];

              return (
                <button
                  key={firstToken.symbol}
                  onClick={() => handleTokenClick(tokenGroup)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[color:var(--color-depth)]/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <TokenLogo symbol={firstToken.symbol} name={firstToken.name} size="sm" />
                    <div>
                      <p className="font-semibold text-sm">{firstToken.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[color:var(--color-depth)]/60">
                      {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                      {firstToken.symbol}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

