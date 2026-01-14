import { useState, useEffect } from "react";
import { TokenAnalytics } from "@/lib/services/tokenAnalyticsService";
import { EVMChain } from "@/components/wallet/data";

export interface UseTokenAnalyticsResult {
  analytics: TokenAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch token analytics (price, 24h change, etc.)
 */
export function useTokenAnalytics(
  symbol: string,
  chain: EVMChain | 'solana',
  contractAddress?: string,
  enabled: boolean = true
): UseTokenAnalyticsResult {
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!enabled || !symbol || !chain) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        chain,
        ...(contractAddress && { contractAddress }),
      });

      const response = await fetch(`/api/token/analytics?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalytics(data.analytics);
    } catch (err: any) {
      console.error("Error fetching token analytics:", err);
      setError(err.message || "Failed to load analytics");
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [symbol, chain, contractAddress, enabled]);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
