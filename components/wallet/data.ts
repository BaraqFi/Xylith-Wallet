export type Chain = "EVM" | "Solana";
export type EVMChain = "ethereum" | "bsc" | "base" | "arbitrum" | "optimism" | "polygon";
export type WalletDirection = "in" | "out" | "swap" | "unknown";

/**
 * Canonical placeholder address for the native token (ETH/BNB/MATIC) on every
 * EVM chain. This is the 1inch/0x convention, so swap quotes can pass it
 * through unchanged. Never use a WETH/wrapped address to represent native —
 * balances shown against it are native balances and must be spent as such.
 */
export const NATIVE_TOKEN_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/** True when a TokenBalance.contractAddress denotes the chain's native token. */
export function isNativeTokenAddress(address?: string | null): boolean {
  if (!address) return true;
  const lower = address.toLowerCase();
  return (
    lower === NATIVE_TOKEN_SENTINEL ||
    lower === "0x0000000000000000000000000000000000000000"
  );
}

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

// Default token lists - metadata only, no mock balances/prices
// Real balances are fetched and merged with these lists

export const defaultEvmTokens: TokenBalance[] = [
  // --- Ethereum Mainnet (12 tokens) ---
  { symbol: "ETH", name: "Ethereum", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "USDT", name: "Tether USD", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  { symbol: "WBTC", name: "Wrapped Bitcoin", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  { symbol: "DAI", name: "Dai Stablecoin", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { symbol: "LINK", name: "Chainlink", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
  { symbol: "UNI", name: "Uniswap", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
  { symbol: "AAVE", name: "Aave", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  { symbol: "MKR", name: "Maker", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x9f8F72Aa9304c8B593d555F12ef6589cC3A579A2", decimals: 18 },
  { symbol: "LDO", name: "Lido DAO", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", decimals: 18 },
  { symbol: "PEPE", name: "Pepe", chain: "EVM", evmChain: "ethereum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18 },

  // --- Base (8 tokens: ETH, USDC + 6 popular/canonical) ---
  { symbol: "ETH", name: "Ethereum", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913", decimals: 6 },
  { symbol: "WETH", name: "Wrapped Ether", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { symbol: "AERO", name: "Aerodrome Finance", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", decimals: 18 },
  { symbol: "BRETT", name: "Brett", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x532f27101965dd16442E59d40670FaF5eBB142E4", decimals: 18 },
  { symbol: "DEGEN", name: "Degen", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", decimals: 18 },
  { symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
  { symbol: "TOSHI", name: "Toshi", chain: "EVM", evmChain: "base", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", decimals: 18 },

  // --- Arbitrum (8 tokens: ETH, USDC + 6 popular/canonical) ---
  { symbol: "ETH", name: "Ethereum", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  { symbol: "ARB", name: "Arbitrum", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
  { symbol: "GMX", name: "GMX", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xfc5A1A6EB076a2C7AD06EDb220f40079d2461Cef", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
  { symbol: "MAGIC", name: "Treasure", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x539bdE0d7Dbd33f84E142a443D954159067b294f", decimals: 18 },
  { symbol: "PENDLE", name: "Pendle", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8", decimals: 18 },
  { symbol: "RDNT", name: "Radiant Capital", chain: "EVM", evmChain: "arbitrum", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x3082CC23568eA640225c2467653dB90e9250AaA0", decimals: 18 },

  // --- Optimism (7 tokens: ETH, USDC + 5 popular/canonical) ---
  { symbol: "ETH", name: "Ethereum", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
  { symbol: "OP", name: "Optimism", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x4200000000000000000000000000000000000042", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { symbol: "VELO", name: "Velodrome Finance", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db", decimals: 18 },
  { symbol: "SNX", name: "Synthetix", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4", decimals: 18 },
  { symbol: "LDO", name: "Lido DAO", chain: "EVM", evmChain: "optimism", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xFdb794692724153d148DbffD3996d63FE9C6A582", decimals: 18 },

  // --- Polygon (7 tokens: MATIC/POL, USDC + 5 popular/canonical) ---
  { symbol: "MATIC", name: "Polygon", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  { symbol: "POL", name: "Polygon Ecosystem Token", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
  { symbol: "LINK", name: "Chainlink", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", decimals: 18 },
  { symbol: "AAVE", name: "Aave", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", decimals: 18 },
  { symbol: "QUICK", name: "QuickSwap", chain: "EVM", evmChain: "polygon", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x831753DD7087CaC61aB5644b308642cc1c33Dc13", decimals: 18 },

  // --- BSC (7 tokens: BNB, USDT + 5 popular/canonical/bluechip + meme) ---
  { symbol: "BNB", name: "BNB", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: NATIVE_TOKEN_SENTINEL, decimals: 18 },
  { symbol: "USDT", name: "Tether USD", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  { symbol: "CAKE", name: "PancakeSwap", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
  { symbol: "ASTER", name: "Aster", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x000ae314e2a2172a039b26378814c252734f556a", decimals: 18 },
  { symbol: "FLOKI", name: "FLOKI", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xfb5B838b6cfEEdC2873aB27866079e553ecab449", decimals: 9 },
  { symbol: "BABYDOGE", name: "Baby Doge Coin", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0xc748673057861a797275CD8A068AbB95A902e8de", decimals: 9 },
  { symbol: "BTCB", name: "Binance-Peg Bitcoin", chain: "EVM", evmChain: "bsc", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
];

export const defaultSolanaTokens: TokenBalance[] = [
  { symbol: "SOL", name: "Solana", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", name: "Tether USD", chain: "Solana", amount: 0, usdValue: 0, pricePerToken: 0, contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { symbol: "RAY", name: "Raydium", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6 },
  { symbol: "JUP", name: "Jupiter", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtosUc6Z5q5Z7Kp5j5q", decimals: 6 },
  { symbol: "BONK", name: "Bonk", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  { symbol: "WIF", name: "dogwifhat", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "EKpQGSJtjMFqKZ9KQanSqErJfPiiSXvSo9YuU451upb5", decimals: 6 },
  { symbol: "PYTH", name: "Pyth Network", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "HZ1JovNiVvGrGNiiYv666wTzXxfgJojhY6tW1Ca97qRu", decimals: 6 },
  { symbol: "JTO", name: "Jito", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "jtojtomePA8beP8AuQc6eKS59uyYP5VC9456F5QTtpt", decimals: 9 },
  { symbol: "RENDER", name: "Render", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8 },
  { symbol: "POPCAT", name: "Popcat", chain: "Solana", amount: 0, pricePerToken: 0, usdValue: 0, contractAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9 },
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

export const SUPPORTED_CHAINS: { label: string; value: EVMChain | "solana"; type: "EVM" | "Solana" }[] = [
  { label: "Ethereum", value: "ethereum", type: "EVM" },
  { label: "Solana", value: "solana", type: "Solana" },
  { label: "Base", value: "base", type: "EVM" },
  { label: "Arbitrum", value: "arbitrum", type: "EVM" },
  { label: "Optimism", value: "optimism", type: "EVM" },
  { label: "Polygon", value: "polygon", type: "EVM" },
  { label: "BNB Smart Chain", value: "bsc", type: "EVM" },
];

