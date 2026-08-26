
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
  contractAddress?: string; // For swaps/buys: the token being bought
  /** For token sends: the ERC-20 contract / SPL mint of the asset being sent. */
  tokenAddress?: string;
  /** For token sends: decimals of the asset being sent. */
  tokenDecimals?: number;
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
 * AI session info returned to the client.
 * The session key is a server-held `LocalAccountSigner` (a documented Alchemy pattern);
 * its encrypted private key + permissions live in the server-side session store, while
 * Privy metadata keeps the session reference (address + expiry). See lib/ai/sessionStore.ts.
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
  /** A dollar amount: "send $50". */
  amountUSD?: number;
  /** An explicit token quantity: "send 0.5 ETH". */
  amountToken?: number;
  /** A share of the balance, 1-100: "half" -> 50, "all" -> 100. */
  amountPercent?: number;
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
