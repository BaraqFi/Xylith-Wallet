/**
 * Security Service
 * 
 * Provides security analysis for tokens, approvals, and swap routes
 * Helps users identify potential risks before executing transactions
 */

import { Address } from "viem";
import { EVMChain } from "@/components/wallet/data";
import { isContractAddress } from "./tokenMetadataService";

export interface TokenRiskAnalysis {
  riskLevel: "low" | "medium" | "high";
  warnings: SecurityWarning[];
  isContract: boolean;
  isVerified?: boolean; // Would require Etherscan API or similar
  hasLowLiquidity?: boolean; // Would require DEX API
}

export interface ApprovalRiskAnalysis {
  riskLevel: "low" | "medium" | "high";
  warnings: SecurityWarning[];
  isUnlimited: boolean;
  approvalAmount: bigint;
  tokenBalance: bigint;
  spenderAddress: Address;
}

export interface SwapRouteRiskAnalysis {
  riskLevel: "low" | "medium" | "high";
  warnings: SecurityWarning[];
  routeThroughUnknownPool?: boolean;
  highSlippage?: boolean;
}

export interface SecurityWarning {
  severity: "error" | "warning" | "info";
  message: string;
  code: string;
}

// Maximum uint256 value (unlimited approval)
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

/**
 * Analyze token risk
 */
export async function analyzeTokenRisk(
  contractAddress: Address,
  chain: EVMChain
): Promise<TokenRiskAnalysis> {
  const warnings: SecurityWarning[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  try {
    // Check if address is a contract
    const isContract = await isContractAddress(contractAddress, chain);

    if (!isContract) {
      warnings.push({
        severity: "error",
        message: "This is not a contract address. Verify the address before proceeding.",
        code: "NOT_CONTRACT",
      });
      riskLevel = "high";
    } else {
      // Check if contract is verified (simplified - would need Etherscan API)
      // For now, we'll just note that verification status is unknown
      warnings.push({
        severity: "info",
        message: "Contract verification status unknown. Verify on block explorer before proceeding.",
        code: "VERIFICATION_UNKNOWN",
      });
      riskLevel = "medium";
    }

    // Additional checks could include:
    // - Known scam/blacklist (would require external API)
    // - Liquidity checks (would require DEX API)
    // - Token age/history (would require on-chain data)

    return {
      riskLevel,
      warnings,
      isContract,
    };
  } catch (error) {
    console.error("Error analyzing token risk:", error);
    warnings.push({
      severity: "warning",
      message: "Unable to verify token security. Proceed with caution.",
      code: "ANALYSIS_FAILED",
    });
    return {
      riskLevel: "medium",
      warnings,
      isContract: false,
    };
  }
}

/**
 * Analyze approval risk
 */
export function analyzeApprovalRisk(
  approvalAmount: bigint,
  tokenBalance: bigint,
  spenderAddress: Address
): ApprovalRiskAnalysis {
  const warnings: SecurityWarning[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  // Check for unlimited approval
  const isUnlimited = approvalAmount >= MAX_UINT256 || approvalAmount === MAX_UINT256;

  if (isUnlimited) {
    warnings.push({
      severity: "error",
      message: "Unlimited approval detected. This allows the contract to spend all your tokens. Only approve if you trust this contract.",
      code: "UNLIMITED_APPROVAL",
    });
    riskLevel = "high";
  } else if (approvalAmount > tokenBalance * BigInt(10)) {
    // Approval is more than 10x current balance
    warnings.push({
      severity: "warning",
      message: `Approval amount (${approvalAmount.toString()}) is significantly higher than your current balance (${tokenBalance.toString()}). Consider approving only what you need.`,
      code: "EXCESSIVE_APPROVAL",
    });
    riskLevel = "medium";
  } else if (approvalAmount > tokenBalance) {
    warnings.push({
      severity: "info",
      message: "Approval amount exceeds current balance. This is normal for future transactions.",
      code: "APPROVAL_EXCEEDS_BALANCE",
    });
  }

  // Check spender address (could be enhanced with known contract database)
  // For now, we'll just note that spender verification is recommended
  warnings.push({
    severity: "info",
    message: "Verify the spender contract address on a block explorer before approving.",
    code: "SPENDER_VERIFICATION_RECOMMENDED",
  });

  return {
    riskLevel,
    warnings,
    isUnlimited,
    approvalAmount,
    tokenBalance,
    spenderAddress,
  };
}

/**
 * Analyze swap route risk
 */
export function analyzeSwapRouteRisk(
  quote: any, // 1inch quote or similar
  slippage: number
): SwapRouteRiskAnalysis {
  const warnings: SecurityWarning[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  // Check slippage
  if (slippage > 5) {
    warnings.push({
      severity: "error",
      message: `High slippage tolerance (${slippage}%). You may receive significantly less than expected.`,
      code: "HIGH_SLIPPAGE",
    });
    riskLevel = "high";
  } else if (slippage > 1) {
    warnings.push({
      severity: "warning",
      message: `Slippage tolerance is ${slippage}%. Consider reducing it for better price protection.`,
      code: "MODERATE_SLIPPAGE",
    });
    riskLevel = "medium";
  }

  // Check if route goes through unknown pools
  // This would require analyzing the quote's route data
  // For now, we'll add a general warning
  if (quote && quote.protocols && quote.protocols.length > 3) {
    warnings.push({
      severity: "info",
      message: "This swap uses multiple routing steps. Verify the route is optimal.",
      code: "COMPLEX_ROUTE",
    });
  }

  return {
    riskLevel,
    warnings,
    highSlippage: slippage > 5,
  };
}

/**
 * Check if recipient address is a contract (for Send flow)
 */
export async function checkRecipientAddress(
  address: Address,
  chain: EVMChain
): Promise<{
  isContract: boolean;
  warning?: SecurityWarning;
}> {
  try {
    const isContract = await isContractAddress(address, chain);
    
    if (isContract) {
      return {
        isContract: true,
        warning: {
          severity: "warning",
          message: "This is a contract address, not a regular wallet. Ensure you trust this contract and are sending to the correct address.",
          code: "RECIPIENT_IS_CONTRACT",
        },
      };
    }

    return { isContract: false };
  } catch (error) {
    console.error("Error checking recipient address:", error);
    return { isContract: false };
  }
}
