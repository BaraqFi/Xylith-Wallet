import { useState, useEffect } from "react";
import { TokenBalance, EVMChain } from "@/components/wallet/data";
import { getTokenList, convertToTokenBalance, searchTokens } from "@/lib/services/tokenListService";
import { TokenListToken } from "@/lib/services/tokenListService";

export function useSwapTokenList(
  chain: EVMChain,
  userBalances: TokenBalance[]
): {
  tokens: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
  searchResults: TokenBalance[];
} {
  const [allTokens, setAllTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadTokenList() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch token list from 1inch
        const tokenList = await getTokenList(chain);

        // Convert to TokenBalance format
        const convertedTokens = tokenList.map((token) => {
          // Check if user has balance for this token
          const userToken = userBalances.find(
            (ut) =>
              ut.contractAddress?.toLowerCase() === token.address.toLowerCase()
          );

          return convertToTokenBalance(
            token,
            chain,
            userToken?.amount || 0,
            userToken?.usdValue || 0
          );
        });

        // Merge with user balances (user balances take precedence)
        const balanceMap = new Map<string, TokenBalance>();
        userBalances.forEach((balance) => {
          if (balance.contractAddress) {
            balanceMap.set(balance.contractAddress.toLowerCase(), balance);
          }
        });

        // Update converted tokens with real balances
        const mergedTokens = convertedTokens.map((token) => {
          if (token.contractAddress) {
            const userBalance = balanceMap.get(
              token.contractAddress.toLowerCase()
            );
            if (userBalance) {
              return {
                ...token,
                amount: userBalance.amount,
                usdValue: userBalance.usdValue,
              };
            }
          }
          return token;
        });

        // Add any user tokens not in the 1inch list
        userBalances.forEach((balance) => {
          if (balance.contractAddress) {
            const exists = mergedTokens.some(
              (t) =>
                t.contractAddress?.toLowerCase() ===
                balance.contractAddress?.toLowerCase()
            );
            if (!exists) {
              mergedTokens.push(balance);
            }
          }
        });

        setAllTokens(mergedTokens);
      } catch (err: any) {
        console.error("Error loading token list:", err);
        setError(err.message || "Failed to load token list");
        // Fallback to user balances only
        setAllTokens(userBalances);
      } finally {
        setIsLoading(false);
      }
    }

    if (chain) {
      loadTokenList();
    }
  }, [chain, userBalances]);

  // Search functionality
  const searchResults = searchQuery
    ? allTokens.filter((token) => {
        const query = searchQuery.toLowerCase();
        return (
          token.symbol.toLowerCase().includes(query) ||
          token.name.toLowerCase().includes(query) ||
          token.contractAddress?.toLowerCase().includes(query)
        );
      })
    : allTokens;

  return {
    tokens: allTokens,
    isLoading,
    error,
    search: setSearchQuery,
    searchResults,
  };
}


