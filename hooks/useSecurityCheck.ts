import { useState, useEffect } from "react";
import { Address } from "viem";
import { EVMChain } from "@/components/wallet/data";
import {
  TokenRiskAnalysis,
  ApprovalRiskAnalysis,
  SwapRouteRiskAnalysis,
} from "@/lib/services/securityService";

export interface UseTokenSecurityResult {
  analysis: TokenRiskAnalysis | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseApprovalSecurityResult {
  analysis: ApprovalRiskAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseSwapSecurityResult {
  analysis: SwapRouteRiskAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check token security
 */
export function useTokenSecurity(
  contractAddress: Address | undefined,
  chain: EVMChain | undefined,
  enabled: boolean = true
): UseTokenSecurityResult {
  const [analysis, setAnalysis] = useState<TokenRiskAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (!enabled || !contractAddress || !chain) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/security/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress, chain }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch security analysis: ${response.statusText}`);
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error("Error fetching token security:", err);
      setError(err.message || "Failed to load security analysis");
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [contractAddress, chain, enabled]);

  return {
    analysis,
    isLoading,
    error,
    refetch: fetchAnalysis,
  };
}

/**
 * Hook to check approval security
 */
export function useApprovalSecurity(
  approvalAmount: bigint | undefined,
  tokenBalance: bigint | undefined,
  spenderAddress: Address | undefined,
  enabled: boolean = true
): UseApprovalSecurityResult {
  const [analysis, setAnalysis] = useState<ApprovalRiskAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !approvalAmount || !tokenBalance || !spenderAddress) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch("/api/security/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalAmount: approvalAmount.toString(),
        tokenBalance: tokenBalance.toString(),
        spenderAddress,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch approval analysis: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        // Convert string values back to BigInt
        setAnalysis({
          ...data.analysis,
          approvalAmount: BigInt(data.analysis.approvalAmount),
          tokenBalance: BigInt(data.analysis.tokenBalance),
        });
      })
      .catch((err) => {
        console.error("Error fetching approval security:", err);
        setError(err.message || "Failed to load approval analysis");
        setAnalysis(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [approvalAmount, tokenBalance, spenderAddress, enabled]);

  return {
    analysis,
    isLoading,
    error,
  };
}

/**
 * Hook to check swap route security
 */
export function useSwapSecurity(
  quote: any,
  slippage: number,
  enabled: boolean = true
): UseSwapSecurityResult {
  const [analysis, setAnalysis] = useState<SwapRouteRiskAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !quote || slippage === undefined) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch("/api/security/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote, slippage }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch swap analysis: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setAnalysis(data.analysis);
      })
      .catch((err) => {
        console.error("Error fetching swap security:", err);
        setError(err.message || "Failed to load swap analysis");
        setAnalysis(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [quote, slippage, enabled]);

  return {
    analysis,
    isLoading,
    error,
  };
}
