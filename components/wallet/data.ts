export type Chain = "EVM" | "Solana";
export type EVMChain = "ethereum" | "bsc" | "base" | "arbitrum" | "optimism" | "polygon";
export type WalletDirection = "in" | "out" | "swap" | "unknown";

export interface ChainBalance {
  label: Chain;
  currencyValue: number;
  nativeLabel: string;
}

export interface TokenAnalytics {
  currentPriceUsd?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  marketCap?: number;
  volume24h?: number;
  sparkline?: number[]; // Array of prices for last 7 days
}

export interface TokenBalance {
  symbol: string;
  name: string;
  chain: Chain;
  evmChain?: EVMChain;
  amount: number;
  usdValue: number;
  deltaNote?: string;
  logo?: string;
  contractAddress?: string;
  pricePerToken?: number;
  decimals?: number;
  analytics?: TokenAnalytics;
}

export interface WalletTransaction {
  id: string;
  action: "Send" | "Receive" | "Swap";
  token: string;
  counterparty: string;
  amountLabel: string;
  timestampLabel: string;
  direction: WalletDirection;
  chain: Chain;
  evmChain?: EVMChain;
  status: "pending" | "confirmed" | "failed";
  blockHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  txHash: string;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  value: string;
  tokenSymbol: string;
  tokenAmount: string;
}

export interface ManualWalletState {
  accountName: string;
  address: string;
  solanaAddress: string;
  mode: "Manual";
  chains: ChainBalance[];
  activeChain: Chain;
  tokens: TokenBalance[];
  transactions: WalletTransaction[];
}

// Calculate total values for accurate balance display
function calculateChainBalances(tokens: TokenBalance[]): ChainBalance[] {
  const evmTotal = tokens
    .filter((t) => t.chain === "EVM")
    .reduce((sum, t) => sum + t.usdValue, 0);
  const solanaTotal = tokens
    .filter((t) => t.chain === "Solana")
    .reduce((sum, t) => sum + t.usdValue, 0);

  // Calculate native amounts (simplified - in real app would fetch prices)
  const ethPrice = 3420;
  const solPrice = 155.8;

  return [
    {
      label: "EVM",
      currencyValue: evmTotal,
      nativeLabel: `${(evmTotal / ethPrice).toFixed(4)} ETH`,
    },
    {
      label: "Solana",
      currencyValue: solanaTotal,
      nativeLabel: `${(solanaTotal / solPrice).toFixed(2)} SOL`,
    },
  ];
}

// Default token lists - metadata only, no mock balances/prices
// Real balances are fetched and merged with these lists

export const defaultEvmTokens: TokenBalance[] = [
  // Ethereum Mainnet
  {
    symbol: "ETH",
    name: "Ethereum",
    chain: "EVM",
    evmChain: "ethereum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x0000000000000000000000000000000000000000",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "ethereum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chain: "EVM",
    evmChain: "ethereum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    chain: "EVM",
    evmChain: "ethereum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    chain: "EVM",
    evmChain: "ethereum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
  },
  // Base
  {
    symbol: "ETH",
    name: "Ethereum",
    chain: "EVM",
    evmChain: "base",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x4200000000000000000000000000000000000006",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "base",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913",
    decimals: 6,
  },
  // Arbitrum
  {
    symbol: "ETH",
    name: "Ethereum",
    chain: "EVM",
    evmChain: "arbitrum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "arbitrum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    chain: "EVM",
    evmChain: "arbitrum",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    decimals: 18,
  },
  // Optimism
  {
    symbol: "ETH",
    name: "Ethereum",
    chain: "EVM",
    evmChain: "optimism",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x4200000000000000000000000000000000000006",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "optimism",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
  },
  {
    symbol: "OP",
    name: "Optimism",
    chain: "EVM",
    evmChain: "optimism",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x4200000000000000000000000000000000000042",
    decimals: 18,
  },
  // Polygon
  {
    symbol: "MATIC",
    name: "Polygon",
    chain: "EVM",
    evmChain: "polygon",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x0000000000000000000000000000000000001010",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "polygon",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chain: "EVM",
    evmChain: "polygon",
    amount: 0,
    usdValue: 0,
    pricePerToken: 0,
    contractAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
  },
  // BSC
  {
    symbol: "BNB",
    name: "BNB",
    chain: "EVM",
    evmChain: "bsc",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x0000000000000000000000000000000000000000",
    decimals: 18,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chain: "EVM",
    evmChain: "bsc",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "EVM",
    evmChain: "bsc",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
  },
];

export const defaultSolanaTokens: TokenBalance[] = [
  {
    symbol: "SOL",
    name: "Solana",
    chain: "Solana",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "Solana",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chain: "Solana",
    amount: 0,
    usdValue: 0,
    pricePerToken: 0,
    contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
  {
    symbol: "RAY",
    name: "Raydium",
    chain: "Solana",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    chain: "Solana",
    amount: 0,
    pricePerToken: 0,
    usdValue: 0,
    contractAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtosUc6Z5q5Z7Kp5j5q",
    decimals: 6,
  },
];

// Default wallet state - real data comes from hooks
export const manualWalletState: ManualWalletState = {
  accountName: "",
  address: "",
  solanaAddress: "",
  mode: "Manual",
  activeChain: "EVM",
  tokens: [], // Empty - real tokens come from useTokenBalances hook
  chains: [
    { label: "EVM", currencyValue: 0, nativeLabel: "0 ETH" },
    { label: "Solana", currencyValue: 0, nativeLabel: "0 SOL" },
  ],
  transactions: [], // Empty - real transactions come from useTransactionHistory hook
};

