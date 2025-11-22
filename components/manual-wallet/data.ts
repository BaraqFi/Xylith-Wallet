export type Chain = "EVM" | "Solana";
export type EVMChain = "ethereum" | "bsc" | "base" | "arbitrum" | "optimism" | "polygon";

export interface ChainBalance {
  label: Chain;
  currencyValue: number;
  nativeLabel: string;
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
}

export interface WalletTransaction {
  id: string;
  action: "Send" | "Receive" | "Swap";
  token: string;
  counterparty: string;
  amountLabel: string;
  timestampLabel: string;
  direction: "in" | "out" | "swap";
  chain: Chain;
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

export const tokens: TokenBalance[] = [
    // Ethereum Mainnet
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "EVM",
      evmChain: "ethereum",
      amount: 0.5324,
      pricePerToken: 3420,
      usdValue: 0.5324 * 3420,
      contractAddress: "0x0000000000000000000000000000000000000000",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "ethereum",
      amount: 2500,
      pricePerToken: 1,
      usdValue: 2500 * 1,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      chain: "EVM",
      evmChain: "ethereum",
      amount: 1200,
      pricePerToken: 1,
      usdValue: 1200 * 1,
      contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
    {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      chain: "EVM",
      evmChain: "ethereum",
      amount: 0.025,
      pricePerToken: 74020,
      usdValue: 0.025 * 74020,
      contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      chain: "EVM",
      evmChain: "ethereum",
      amount: 850,
      pricePerToken: 1,
      usdValue: 850 * 1,
      contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    },
    // Base
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "EVM",
      evmChain: "base",
      amount: 0.15,
      pricePerToken: 3420,
      usdValue: 0.15 * 3420,
      contractAddress: "0x4200000000000000000000000000000000000006",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "base",
      amount: 1500,
      pricePerToken: 1,
      usdValue: 1500 * 1,
      contractAddress: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913",
    },
    // Arbitrum
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "EVM",
      evmChain: "arbitrum",
      amount: 0.08,
      pricePerToken: 3420,
      usdValue: 0.08 * 3420,
      contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "arbitrum",
      amount: 800,
      pricePerToken: 1,
      usdValue: 800 * 1,
      contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    {
      symbol: "ARB",
      name: "Arbitrum",
      chain: "EVM",
      evmChain: "arbitrum",
      amount: 500,
      pricePerToken: 1.3,
      usdValue: 500 * 1.3,
      contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    },
    // Optimism
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "EVM",
      evmChain: "optimism",
      amount: 0.12,
      pricePerToken: 3420,
      usdValue: 0.12 * 3420,
      contractAddress: "0x4200000000000000000000000000000000000006",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "optimism",
      amount: 600,
      pricePerToken: 1,
      usdValue: 600 * 1,
      contractAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
    {
      symbol: "OP",
      name: "Optimism",
      chain: "EVM",
      evmChain: "optimism",
      amount: 300,
      pricePerToken: 2.5,
      usdValue: 300 * 2.5,
      contractAddress: "0x4200000000000000000000000000000000000042",
    },
    // Polygon
    {
      symbol: "MATIC",
      name: "Polygon",
      chain: "EVM",
      evmChain: "polygon",
      amount: 2000,
      pricePerToken: 0.7,
      usdValue: 2000 * 0.7,
      contractAddress: "0x0000000000000000000000000000000000001010",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "polygon",
      amount: 400,
      pricePerToken: 1,
      usdValue: 400 * 1,
      contractAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      chain: "EVM",
      evmChain: "polygon",
      amount: 300,
      usdValue: 300,
      pricePerToken: 1,
      contractAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
    // BSC
    {
      symbol: "BNB",
      name: "BNB",
      chain: "EVM",
      evmChain: "bsc",
      amount: 2.5,
      pricePerToken: 250,
      usdValue: 2.5 * 250,
      contractAddress: "0x0000000000000000000000000000000000000000",
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      chain: "EVM",
      evmChain: "bsc",
      amount: 1200,
      pricePerToken: 1,
      usdValue: 1200 * 1,
      contractAddress: "0x55d398326f99059fF775485246999027B3197955",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "EVM",
      evmChain: "bsc",
      amount: 500,
      pricePerToken: 1,
      usdValue: 500 * 1,
      contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    },
    // Solana
    {
      symbol: "SOL",
      name: "Solana",
      chain: "Solana",
      amount: 28.02,
      pricePerToken: 155.8,
      usdValue: 28.02 * 155.8,
      contractAddress: "So11111111111111111111111111111111111111112",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "Solana",
      amount: 500,
      pricePerToken: 1,
      usdValue: 500 * 1,
      contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      chain: "Solana",
      amount: 300,
      usdValue: 300,
      pricePerToken: 1,
      contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    },
    {
      symbol: "RAY",
      name: "Raydium",
      chain: "Solana",
      amount: 150,
      pricePerToken: 1.5,
      usdValue: 150 * 1.5,
      contractAddress: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    },
    {
      symbol: "JUP",
      name: "Jupiter",
      chain: "Solana",
      amount: 200,
      pricePerToken: 0.9,
      usdValue: 200 * 0.9,
      contractAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtosUc6Z5q5Z7Kp5j5q",
    },
];

export const manualWalletState: ManualWalletState = {
  accountName: "0xReghas",
  address: "0xAbc1234567890123456789012345678901234567",
  mode: "Manual",
  activeChain: "EVM",
  tokens,
  chains: calculateChainBalances(tokens),
  transactions: [
    {
      id: "tx-send-usdc-001",
      action: "Send",
      token: "USDC",
      counterparty: "0x9924a3b8c5d4e6f7a9b0c1d2e3f4a5b6c7d8e9f0",
      amountLabel: "-250.00 USDC",
      timestampLabel: "2h ago",
      direction: "out",
      chain: "EVM",
      status: "confirmed",
      blockHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
      blockNumber: 19876543,
      gasUsed: "21000",
      gasPrice: "30",
      txHash: "0x9f8e7d6c5b4a392817263544332211009f8e7d6c5b4a3928172635443322110",
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      fromAddress: "0xAbc1234567890123456789012345678901234567",
      toAddress: "0x9924a3b8c5d4e6f7a9b0c1d2e3f4a5b6c7d8e9f0",
      value: "250.00",
      tokenSymbol: "USDC",
      tokenAmount: "250.00",
    },
    {
      id: "tx-swap-usdc-eth-001",
      action: "Swap",
      token: "USDC → ETH",
      counterparty: "Route: Uniswap V3",
      amountLabel: "-$250.00 / +0.0901 ETH",
      timestampLabel: "1 day ago",
      direction: "swap",
      chain: "EVM",
      status: "confirmed",
      blockHash: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3",
      blockNumber: 19872000,
      gasUsed: "185000",
      gasPrice: "32",
      txHash: "0x8e7d6c5b4a392817263544332211009f8e7d6c5b4a392817263544332211009",
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
      fromAddress: "0xAbc1234567890123456789012345678901234567",
      toAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      value: "250.00",
      tokenSymbol: "USDC",
      tokenAmount: "250.00",
    },
    {
      id: "tx-receive-sol-001",
      action: "Receive",
      token: "SOL",
      counterparty: "H1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0",
      amountLabel: "+8.25 SOL",
      timestampLabel: "2 days ago",
      direction: "in",
      chain: "Solana",
      status: "confirmed",
      blockHash: "7xKp9mN2vQ5wR8tY1uI4oP6aS3dF7gH0jK2lM5nQ8rT1vW4yZ7aB0cE3fG6hJ9",
      blockNumber: 245678901,
      gasUsed: "5000",
      gasPrice: "0.000005",
      txHash: "5xJp8mL1uO4vP7sR0tW3yU6oI9pS2dE5fH8jK1lN4qR7tV0wX3yA6bC9eF2gI5",
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
      fromAddress: "H1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0",
      toAddress: "Abc123456789012345678901234567890123456789012345678901234567",
      value: "8.25",
      tokenSymbol: "SOL",
      tokenAmount: "8.25",
    },
    {
      id: "tx-send-eth-001",
      action: "Send",
      token: "ETH",
      counterparty: "0x5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4",
      amountLabel: "-0.05 ETH",
      timestampLabel: "3 days ago",
      direction: "out",
      chain: "EVM",
      status: "confirmed",
      blockHash: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
      blockNumber: 19865000,
      gasUsed: "21000",
      gasPrice: "28",
      txHash: "0x7d6c5b4a392817263544332211009f8e7d6c5b4a392817263544332211009f8",
      timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
      fromAddress: "0xAbc1234567890123456789012345678901234567",
      toAddress: "0x5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4",
      value: "0.05",
      tokenSymbol: "ETH",
      tokenAmount: "0.05",
    },
    {
      id: "tx-pending-swap-001",
      action: "Swap",
      token: "DAI → USDT",
      counterparty: "Route: Curve",
      amountLabel: "-500.00 DAI / +500.00 USDT",
      timestampLabel: "Pending",
      direction: "swap",
      chain: "EVM",
      status: "pending",
      txHash: "0x6c5b4a392817263544332211009f8e7d6c5b4a392817263544332211009f8e7",
      timestamp: Date.now(),
      fromAddress: "0xAbc1234567890123456789012345678901234567",
      toAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      value: "500.00",
      tokenSymbol: "DAI",
      tokenAmount: "500.00",
    },
  ],
};

