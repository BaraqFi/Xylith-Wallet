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
            // User requested to use Alchemy for this specific call as Chainstack may fail for all tokens
            const alchemyKey = process.env.ALCHEMY_SOLANA_KEY;
            let customRpcUrl = null;

            if (alchemyKey) {
                if (typeof window === 'undefined') {
                    customRpcUrl = `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`;
                }
                // Note: Client-side proxy logic uses the generic server RPC handler, 
                // we might need to update the proxy handler if we strictly want Alchemy there too.
                // For now, we assume this runs primarily server-side or via proxy that defaults correctly.
                // If we are server side:
            }

            // For this specific method, if we are server-side and have alchemy, use it directly via a fresh fetch 
            // instead of the generic rpcCall which might pick Chainstack.
            if (typeof window === 'undefined' && alchemyKey) {
                const response = await fetch(`https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTokenAccountsByOwner',
                        params: [
                            address,
                            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                            { encoding: 'jsonParsed' },
                        ],
                    }),
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                return data.result.value.map((item: any) => ({
                    pubkey: item.pubkey,
                    mint: item.account.data.parsed.info.mint,
                    owner: item.account.data.parsed.info.owner,
                    amount: item.account.data.parsed.info.tokenAmount.amount,
                    decimals: item.account.data.parsed.info.tokenAmount.decimals,
                }));
            }

            // Fallback to standard flow if client-side or no alchemy key
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

    // Fetch a recent blockhash (proxied client-side, avoiding CORS/rate limits
    // on public RPC endpoints)
    async getLatestBlockhash(): Promise<string> {
        const result = await this.rpcCall('getLatestBlockhash', [
            { commitment: 'confirmed' },
        ]);
        return result.value.blockhash;
    }

    // Does an account exist on-chain? Used to tell whether an SPL transfer must
    // also create (and pay rent for) the recipient's associated token account.
    async accountExists(address: string): Promise<boolean> {
        try {
            const result = await this.rpcCall('getAccountInfo', [
                address,
                { encoding: 'base64' },
            ]);
            return !!result?.value;
        } catch (error) {
            console.warn('Could not check account existence:', error);
            // Assume it exists: the idempotent create instruction is a no-op if it
            // does, and over-stating the fee is better than under-stating it.
            return true;
        }
    }

    /**
     * Poll until a signature reaches a terminal state.
     *
     * A submitted signature is not a landed transaction — it can still be
     * dropped or fail on-chain — so callers must not report success on the
     * send alone. Returns 'pending' if it hasn't settled within the timeout,
     * which is a real outcome rather than a failure.
     */
    async confirmTransaction(
        signature: string,
        timeoutMs = 30000,
    ): Promise<{ status: 'confirmed' | 'failed' | 'pending'; error?: string }> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const result = await this.rpcCall('getSignatureStatuses', [
                    [signature],
                    { searchTransactionHistory: true },
                ]);
                const info = result?.value?.[0];
                if (info) {
                    if (info.err) {
                        return { status: 'failed', error: JSON.stringify(info.err) };
                    }
                    if (
                        info.confirmationStatus === 'confirmed' ||
                        info.confirmationStatus === 'finalized'
                    ) {
                        return { status: 'confirmed' };
                    }
                }
            } catch (error) {
                console.warn('Signature status check failed:', error);
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        return { status: 'pending' };
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
