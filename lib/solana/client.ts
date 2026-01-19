import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

// Default to mainnet-beta public RPC if no env var
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Generic interfaces for RPC responses if not using full typed library for everything
export interface SolBalance {
    value: number; // Lamports
}

export interface TokenAccount {
    pubkey: string;
    mint: string;
    owner: string;
    amount: string;
    decimals: number;
}

export class SolanaClient {
    private proxyUrl = '/api/rpc?chain=solana';

    constructor() { }

    // Helper to make RPC calls via proxy
    private async rpcCall(method: string, params: any[]) {
        if (typeof window === 'undefined') {
            // Server-side: use direct RPC URL from env if possible, or fail if not configured
            // Use the Chainstack RPC for server-side calls if available
            const rpcUrl = process.env.CHAINSTACK_SOLANA_MAINNET_RPC ||
                (process.env.ALCHEMY_SOLANA_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_SOLANA_KEY}` : null) ||
                process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
                'https://api.mainnet-beta.solana.com';

            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params,
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.result;
        }

        // Client-side: use proxy
        const response = await fetch(this.proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method,
                params
            }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message || data.error.code);
        return data.result;
    }

    // Fetch native SOL balance
    async getBalance(address: string): Promise<number> {
        try {
            const result = await this.rpcCall('getBalance', [address]);
            return result.value; // Returns lamports
        } catch (error) {
            console.error('Error fetching SOL balance:', error);
            return 0;
        }
    }

    // Fetch SPL Token Accounts
    async getTokenAccounts(address: string): Promise<TokenAccount[]> {
        try {
            const result = await this.rpcCall('getTokenAccountsByOwner', [
                address,
                { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                { encoding: 'jsonParsed' },
            ]);

            return result.value.map((item: any) => ({
                pubkey: item.pubkey,
                mint: item.account.data.parsed.info.mint,
                owner: item.account.data.parsed.info.owner,
                amount: item.account.data.parsed.info.tokenAmount.amount,
                decimals: item.account.data.parsed.info.tokenAmount.decimals,
            }));
        } catch (error) {
            console.error('Error fetching SPL token accounts:', error);
            return [];
        }
    }

    // Send Raw Transaction
    async sendRawTransaction(base64Tx: string): Promise<string> {
        try {
            const result = await this.rpcCall('sendTransaction', [
                base64Tx,
                { encoding: 'base64' }
            ]);
            return result; // Returns signature
        } catch (error) {
            console.error('Error sending raw transaction:', error);
            throw error;
        }
    }
}

export const solanaClient = new SolanaClient();
