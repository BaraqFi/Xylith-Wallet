"use client";

import { useState, useMemo, useEffect } from "react";
import { TokenBalance, EVMChain } from "./data";
import { TokenLogo } from "./ManualWallet";
import { Input } from "@/components/ui/input";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { fetchTokenMetadata, isValidContractAddress, isContractAddress } from "@/lib/services/tokenMetadataService";
import { Address } from "viem";

interface TokenSelectModalProps {
  tokens: TokenBalance[];
  onSelect: (token: TokenBalance) => void;
  onClose: () => void;
  excludeSymbol?: string;
  chain?: EVMChain; // Optional chain for CA-based search
  chainFilter?: string | null; // Optional filter to restrict tokens to a specific chain type (e.g. "Solana" or "EVM")
}

export function TokenSelectModal({
  tokens,
  onSelect,
  onClose,
  excludeSymbol,
  chain,
  chainFilter,
}: TokenSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [caToken, setCaToken] = useState<TokenBalance | null>(null);
  const [isLoadingCA, setIsLoadingCA] = useState(false);
  const [caError, setCaError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);

  // Handle contract address search
  useEffect(() => {
    const query = searchQuery.trim();

    // Reset CA token state if query changes
    if (!isValidContractAddress(query)) {
      setCaToken(null);
      setCaError(null);
      setIsUnverified(false);
      return;
    }

    // Only fetch if chain is provided and query looks like a contract address
    if (!chain || !isValidContractAddress(query)) {
      return;
    }

    setIsLoadingCA(true);
    setCaError(null);
    setIsUnverified(false);

    const fetchCA = async () => {
      try {
        // Check if it's a contract
        const isContract = await isContractAddress(query as Address, chain);
        if (!isContract) {
          setCaError("Address is not a contract");
          setIsLoadingCA(false);
          return;
        }

        // Fetch token metadata
        const metadata = await fetchTokenMetadata(query as Address, chain);

        if (!metadata) {
          throw new Error("Could not fetch metadata");
        }

        // Check if token already exists in list
        const existing = tokens.find(
          (t) => t.contractAddress?.toLowerCase() === query.toLowerCase()
        );

        if (existing) {
          setCaToken(existing);
        } else {
          // Create new token from metadata
          const newToken: TokenBalance = {
            symbol: metadata.symbol,
            name: metadata.name,
            chain: "EVM",
            evmChain: chain,
            amount: 0,
            usdValue: 0,
            contractAddress: query,
            decimals: metadata.decimals,
            logo: metadata.logo,
          };
          setCaToken(newToken);
          setIsUnverified(true); // Mark as unverified since it's not in our trusted list
        }
      } catch (error: any) {
        setCaError(error.message || "Failed to fetch token metadata");
        setCaToken(null);
      } finally {
        setIsLoadingCA(false);
      }
    };

    const timeoutId = setTimeout(fetchCA, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchQuery, chain, tokens]);

  // Filter and search
  const filteredTokens = useMemo(() => {
    const seenTokenKeys = new Set<string>();
    return tokens
      .filter((token) => {
        // 1. Exclude Symbol
        if (excludeSymbol && token.symbol === excludeSymbol) return false;

        // 2. Chain Filter
        if (chainFilter && token.chain !== chainFilter) return false;

        // 3. Search Query
        const query = searchQuery.toLowerCase();
        if (!query) return true; // Include all if no search query
        return (
          token.symbol.toLowerCase().includes(query) ||
          token.name.toLowerCase().includes(query) ||
          token.contractAddress?.toLowerCase().includes(query)
        );
      })
      .filter((token) => {
        // Deduplicate based on unique key (Symbol + Chain + EVMChain)
        const key = `${token.symbol}-${token.chain}-${token.evmChain || ''}`;
        if (seenTokenKeys.has(key)) return false;
        seenTokenKeys.add(key);
        return true;
      })
      .sort((a, b) => {
        const aHasBalance = a.amount > 0 || a.usdValue > 0;
        const bHasBalance = b.amount > 0 || b.usdValue > 0;

        if (aHasBalance && !bHasBalance) return -1;
        if (!aHasBalance && bHasBalance) return 1;

        // If both have balance or both don't, sort by USD value
        if (a.usdValue !== b.usdValue) {
          return b.usdValue - a.usdValue;
        }

        // Then by symbol
        return a.symbol.localeCompare(b.symbol);
      });
  }, [tokens, searchQuery, excludeSymbol, chainFilter]);

  const handleTokenClick = (token: TokenBalance) => {
    onSelect(token);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4"
      onClick={onClose}
    >
      <div
        className="wallet-card w-full max-w-md max-h-[80vh] flex flex-col p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[color:var(--color-border)] px-1">
          <button
            onClick={onClose}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)] p-1"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-[color:var(--color-depth)]">
            Select Token
          </h2>
          <div className="w-5" /> {/* Spacer for centering */}
        </div>

        <div className="mb-4 px-1">
          <Input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 px-1">
          {/* Contract Address Search Result */}
          {isLoadingCA && isValidContractAddress(searchQuery.trim()) && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[color:var(--color-depth)]/5 border border-[color:var(--color-depth)]/10">
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-accent)]" />
              <p className="text-sm text-[color:var(--color-depth)]/60">Loading token metadata...</p>
            </div>
          )}

          {caError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{caError}</p>
            </div>
          )}

          {caToken && !caError && (
            <div className="mb-2">
              <button
                onClick={() => {
                  onSelect(caToken);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[color:var(--color-depth)]/5 transition-colors text-left border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/5"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={caToken.symbol} name={caToken.name} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{caToken.name}</p>
                      {isUnverified && (
                        <div title="Unverified Token">
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[color:var(--color-depth)]/50 font-mono">
                      {caToken.contractAddress?.slice(0, 10)}...{caToken.contractAddress?.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">0 {caToken.symbol}</p>
                  {isUnverified && (
                    <p className="text-xs text-yellow-600">Unverified</p>
                  )}
                </div>
              </button>
              {isUnverified && (
                <p className="text-xs text-yellow-600 mt-1 px-3">
                  This token is not in our verified list. Please verify the contract address before proceeding.
                </p>
              )}
            </div>
          )}

          {filteredTokens.length === 0 && !caToken && !isLoadingCA ? (
            <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={`${token.symbol}-${token.chain}-${token.evmChain || ''}`}
                onClick={() => handleTokenClick(token)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[color:var(--color-depth)]/5 transition-colors text-left mx-1"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={token.symbol} name={token.name} size="sm" />
                  <div>
                    <p className="font-semibold text-sm">{token.name}</p>
                    <p className="text-xs text-[color:var(--color-depth)]/60">
                      {token.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-xs text-[color:var(--color-depth)]/60">
                    ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

