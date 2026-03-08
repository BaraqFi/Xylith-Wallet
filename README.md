# Xylith Wallet

An AI-powered crypto wallet that lets you manage and trade tokens across **EVM chains** and **Solana** — using either traditional wallet controls or plain-English chat commands.

---

## What Is Xylith?

Xylith is a cryptocurrency wallet with two ways to use it:

- **Manual Mode** — A full-featured wallet where you send, receive, and swap tokens yourself.
- **AI Mode** — A chat interface where you type what you want to do in plain English, and the AI handles the rest.

You can switch between modes anytime. Your funds, your rules.

---

## Features

### 💼 Wallet Basics
- **Multi-chain support** — Works with Ethereum, Base, Polygon, Arbitrum, Solana, and more
- **Send & receive** tokens on any supported chain
- **View balances** across all your chains at a glance
- **Transaction history** to track your activity
- **QR code** for easy address sharing

### 🔄 Token Swaps
- Swap tokens on the same chain (e.g. ETH → USDC on Base)
- Real-time quotes and route optimization
- Cross-chain swaps between EVM networks and Solana *(coming soon)*

### 🤖 AI Chat Commands
Tell the AI what you want to do, naturally:

| What you type | What happens |
|---|---|
| `send $10 ETH to 0x99… on ethereum` | Sends $10 worth of ETH to that address |
| `swap $100 USDC to SOL` | Swaps $100 of USDC for SOL |
| `buy 0x887… on base` | Buys a token by its contract address using your native balance |
| `check balance on sol, base, eth` | Shows your balances across those chains |

The AI understands flexible syntax — case-insensitive, supports dollar amounts or raw token quantities, and figures out the chain from context.

### 🔐 Security & Control
- **Non-custodial** — You always own your keys. Xylith never has access to your private key.
- **Spending limits** — Set a budget for the AI (daily or weekly). It can't exceed what you allow.
- **Session keys** — The AI gets temporary, limited permission to act on your behalf. No permanent access.
- **Instant revoke** — Turn off AI access at any time from your wallet settings. Immediate effect, on-chain enforced.

---

## How AI Mode Works (In Simple Terms)

1. You **activate AI mode** and set a spending limit (e.g. "$200 per day").
2. You type a command like `swap $50 ETH to USDC on base`.
3. The AI **understands your intent**, builds the transaction, and executes it — all within your approved budget.
4. You get a **confirmation with a transaction link** when it's done.
5. You can **revoke AI access** anytime. One tap, done.

The AI never holds your funds or your keys. It operates under strict, user-defined rules enforced at the smart contract level.

---

## Supported Chains

| Chain | Send/Receive | Swap | AI Mode |
|---|:---:|:---:|:---:|
| Ethereum | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ |
| Arbitrum | ✅ | ✅ | ✅ |
| Optimism | ✅ | ✅ | ✅ |
| BSC | ✅ | ✅ | ✅ |
| Solana | ✅ | 🔜 | 🔜 |

---

## Roadmap

- [x] Multi-chain wallet (send, receive, view balances)
- [x] Same-chain token swaps
- [x] AI chat interface
- [ ] Cross-chain swaps (EVM ↔ Solana)
- [ ] AI spending limits & session management
- [ ] Transaction history summarizer (AI-powered)
- [ ] Memecoin quick-buy by contract address
- [ ] Plugin support for partner protocols

---

## Status

Xylith is in **active development**. The manual wallet and AI chat interface are functional. AI-powered transaction execution and cross-chain swaps are in progress.
