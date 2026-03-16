
/**
 * Supported blockchain networks.
 */
export type Chain = 'ETH' | 'BASE' | 'ARB' | 'SOL';

/**
 * Types of transactions the agent can handle.
 */
export type TxType = 'SEND' | 'SWAP' | 'BRIDGE' | 'APPROVE';

/**
 * Represents a blockchain transaction with enhanced metadata.
 */
export interface Transaction {
  id: string;
  type: TxType;
  chain: Chain;
  targetChain?: Chain; // For bridges
  amount: number;
  amountUSD: number;
  token: string;
  targetToken?: string; // For swaps
  recipient?: string; // For sends
  contractAddress?: string; // For swaps/buys
  timestamp: number;
  status: 'ANALYZING' | 'ESTIMATING_GAS' | 'NEEDS_APPROVAL' | 'BROADCASTING' | 'COMPLETED' | 'FAILED';
  hash?: string;
  error?: string;
  // New Fields
  gasEstimate?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  technicalSummary?: string;
}

/**
 * AI session info stored in Privy user metadata.
 * No private keys — Alchemy Signer handles all key material in Turnkey enclaves.
 * The sessionReference is an opaque identifier pointing to the session Alchemy manages.
 */
export interface AiSessionInfo {
  /** The Alchemy session permissions object returned by grantPermissions() */
  sessionPermissions: unknown;
  /** Unix timestamp (ms) when this session expires */
  sessionExpiry: number;
  /** The public address of the session key signer */
  signerAddress: string;
}

export interface BalanceMap {
  [key: string]: {
    native: number;
  };
}

export interface SpendingLimit {
  amount: number;
  period: 'DAILY' | 'WEEKLY';
  lastReset: number;
  currentUsage: number;
  isEnabled: boolean;
  // New Setting
  defaultBuyAmountUSD: number;
}

/**
 * Represents a line in the terminal output.
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'USER' | 'AGENT' | 'ERROR' | 'SUCCESS';
  content: string;
  txId?: string;
}

export interface TxHistoryItem {
  hash: string;
  from?: string;
  to?: string;
  value: number; // In native units
  timestamp?: number;
  success: boolean;
  chain: Chain;
}

/**
 * Structured output from the Gemini AI model.
 */
export interface AICommand {
  intent: 'SEND' | 'SWAP' | 'BRIDGE' | 'BALANCE' | 'CHAT' | 'HISTORY' | 'HISTORY_SUMMARY';
  chain?: Chain;
  targetChain?: Chain;
  amountUSD?: number;
  limit?: number; // For History requests
  token?: string;
  targetToken?: string;
  recipient?: string;
  contractAddress?: string;
  reply: string;
  reasoning: string;
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  technicalSummary: string;
}
