"use client";

import { useState, useMemo, useEffect } from "react";
import { TokenBalance, EVMChain } from "./data";
import { TokenLogo } from "./TokenLogo";
import { Input } from "@/components/ui/input";
import { X, Search, Check, Loader2, AlertTriangle } from "lucide-react";
import { fetchTokenMetadata, isValidContractAddress, isContractAddress } from "@/lib/services/tokenMetadataService";
import { Address } from "viem";

interface TokenSelectModalProps {
  tokens: TokenBalance[];
  onSelect: (token: TokenBalance) => void;
  onClose: () => void;
  excludeSymbol?: string;
  chain?: EVMChain;
  chainFilter?: string | null;
  /** Async callback for global asset searching (mint address, symbol, name) */
  onSearch?: (query: string) => Promise<TokenBalance[]>;
  /** Selected token balance object to show checkmark */
  selectedToken?: TokenBalance | null;
}

export function TokenSelectModal({
  tokens,
  onSelect,
  onClose,
  excludeSymbol,
  chain,
  chainFilter,
  onSearch,
  selectedToken,
}: TokenSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<TokenBalance[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Specific state for EVM CA checking (legacy support)
  const [caToken, setCaToken] = useState<TokenBalance | null>(null);
  const [isLoadingCA, setIsLoadingCA] = useState(false);
  const [caError, setCaError] = useState<string | null>(null);

  // 1. Popular Assets (Top verified tokens - currently hardcoded fast path)
  // In a real app, this might come from a prop or specific filtered list
  const popularTokens = useMemo(() => {
    // Basic heuristics for "Popular": SOL, USDC, USDT, ETH, BTC, BONK, JUP
    const popularitySet = new Set(["SOL", "USDC", "USDT", "ETH", "WBTC", "BONK", "JUP"]);
    return tokens.filter(t => popularitySet.has(t.symbol)).slice(0, 8);
  }, [tokens]);

  // 2. Local Filtering
  const localFiltered = useMemo(() => {
    const s = searchQuery.toLowerCase().trim();
    if (!s) return tokens;

    return tokens.filter((token) => {
      // Chain Filter
      if (chainFilter && token.chain !== chainFilter) return false;
      // Exclude Symbol
      if (excludeSymbol && token.symbol === excludeSymbol) return false;

      return (
        token.symbol.toLowerCase().includes(s) ||
        token.name.toLowerCase().includes(s) ||
        token.contractAddress?.toLowerCase() === s
      );
    });
  }, [tokens, searchQuery, excludeSymbol, chainFilter]);

  // 3. Remote Search (Debounced)
  useEffect(() => {
    if (!onSearch || searchQuery.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearch(searchQuery);
        setRemoteResults(results);
      } catch (e) {
        console.error("Remote search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  // 4. EVM Contract Address Check (Legacy / Fallback for EVM)
  useEffect(() => {
    const query = searchQuery.trim();
    // Only if searching EVM chain explicitly and query looks like address
    if (chain && isValidContractAddress(query)) {
      setIsLoadingCA(true);
      // ... (existing logic could go here if we strictly need on-chain metadata fetch)
      // For now, if onSearch is provided (e.g. 1inch API for EVM), we prefer that.
      // Keeping simple placeholder or relying on onSearch.
      setIsLoadingCA(false);
    } else {
      setCaToken(null);
      setCaError(null);
    }
  }, [searchQuery, chain]);

  // 5. Merge Results
  const finalResults = useMemo(() => {
    // If we have remote results, likely we want to show them prioritized or merged.
    // Simpler approach: If remote results exist, show them mixed with local matches.

    // Deduplicate by address or symbol+chain
    const seen = new Set<string>();
    const merged: TokenBalance[] = [];

    // Helper to add unique
    const add = (list: TokenBalance[]) => {
      list.forEach(t => {
        const key = t.contractAddress ? t.contractAddress.toLowerCase() : t.symbol;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(t);
        }
      });
    };

    if (searchQuery) {
      add(localFiltered);
      add(remoteResults);
      return merged;
    } else {
      // If no search, just show local tokens (balances or default list)
      return tokens;
    }
  }, [localFiltered, remoteResults, searchQuery, tokens]);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--color-surface)] w-full max-w-sm h-[680px] flex flex-col rounded-[2rem] p-5 shadow-2xl border border-[color:var(--color-border)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-[color:var(--color-depth)]">Select Token</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-[color:var(--color-depth)]/40 hover:text-[color:var(--color-depth)] transition-colors rounded-full hover:bg-[color:var(--color-depth)]/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-depth)]/40">
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </div>
          <Input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, Symbol or Address"
            className="w-full text-base py-6 pl-12 pr-4 rounded-2xl bg-[color:var(--color-depth)]/5 border-transparent focus:bg-transparent focus:border-[color:var(--color-accent)]/30 transition-all font-medium placeholder:text-[color:var(--color-depth)]/30"
          />
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 pb-2 space-y-6">

          {/* Popular Assets (Only show if no search query) */}
          {!searchQuery && popularTokens.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-depth)]/40 mb-3 px-2">Popular Assets</p>
              <div className="flex flex-wrap gap-2 px-1">
                {popularTokens.map(t => (
                  <button
                    key={`pop-${t.symbol}`}
                    onClick={() => { onSelect(t); onClose(); }}
                    className={`
                                    flex items-center gap-2 px-3 py-2 rounded-full border transition-all
                                    ${selectedToken?.symbol === t.symbol
                        ? 'bg-[color:var(--color-accent)]/10 border-[color:var(--color-accent)] text-[color:var(--color-accent)]'
                        : 'bg-[color:var(--color-depth)]/5 border-transparent hover:bg-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]/80'}
                                `}
                  >
                    <TokenLogo symbol={t.symbol} name={t.name} size="xs" src={t.logo} />
                    <span className="text-xs font-bold">{t.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token List */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-depth)]/40 mb-2 px-2">
              {searchQuery ? "Search Results" : "Verified Tokens"}
            </p>

            {finalResults.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 text-[color:var(--color-depth)]/30">
                <Search size={32} strokeWidth={1.5} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">No assets found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {finalResults.map((token, idx) => {
                  const isSelected = selectedToken?.symbol === token.symbol && selectedToken?.chain === token.chain;
                  return (
                    <button
                      key={`${token.symbol}-${token.chain}-${idx}`}
                      onClick={() => { onSelect(token); onClose(); }}
                      className={`
                                        w-full flex items-center gap-3 p-3 rounded-2xl transition-all group
                                        ${isSelected ? 'bg-[color:var(--color-depth)]/5' : 'hover:bg-[color:var(--color-depth)]/5'}
                                    `}
                    >
                      {/* Icon Container with Checkmark */}
                      <div className="relative flex-shrink-0">
                        <TokenLogo symbol={token.symbol} name={token.name} size="md" src={token.logo} />
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 bg-[color:var(--color-accent)] text-[color:var(--color-surface)] rounded-full p-0.5 border-2 border-[color:var(--color-surface)]">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      {/* Token Info */}
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <div className="flex items-center gap-2 w-full">
                          <span className={`text-sm font-bold truncate ${isSelected ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-depth)]'}`}>
                            {token.symbol}
                          </span>
                          {/* Optional: Add Verified Badge if needed */}
                        </div>
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs text-[color:var(--color-depth)]/50 truncate max-w-[120px]">
                            {token.name}
                          </span>
                        </div>
                      </div>

                      {/* Address / Balance */}
                      <div className="flex flex-col items-end text-right">
                        {(token.amount > 0 || token.usdValue > 0) ? (
                          <>
                            <span className="text-sm font-bold text-[color:var(--color-depth)]">
                              {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                            <span className="text-xs text-[color:var(--color-depth)]/40">
                              ${token.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </>
                        ) : token.contractAddress ? (
                          <span className="font-mono text-[10px] text-[color:var(--color-depth)]/30 group-hover:text-[color:var(--color-depth)]/50 transition-colors bg-[color:var(--color-depth)]/5 px-1.5 py-0.5 rounded">
                            {token.contractAddress.slice(0, 4)}...{token.contractAddress.slice(-4)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

