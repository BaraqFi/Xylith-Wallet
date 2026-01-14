interface JupiterQuoteParams {
    inputMint: string;
    outputMint: string;
    amount: string; // Atomic units (e.g. lamports)
    slippageBps?: number; // 50 = 0.5%
    mode?: 'ExactIn' | 'ExactOut';
}

interface JupiterSwapParams {
    quoteResponse: any; // The full quote object from getQuote
    userPublicKey: string;
    wrapAndUnwrapSol?: boolean; // Default is true
    // feeAccount is optional
}

export class JupiterClient {
    private static BASE_URL = "/api/jupiter";

    // Get Quote - calls server route which handles API key securely
    static async getQuote(params: JupiterQuoteParams) {
        const searchParams = new URLSearchParams({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: params.amount,
        });
        if (params.slippageBps) {
            searchParams.append("slippageBps", params.slippageBps.toString());
        }

        const res = await fetch(`${this.BASE_URL}/quote?${searchParams}`);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || error.description || "Failed to fetch quote");
        }
        return res.json();
    }

    // Get Swap Transaction - calls server route which handles API key securely
    static async getSwapTransaction(params: JupiterSwapParams) {
        const res = await fetch(`${this.BASE_URL}/swap`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                quoteResponse: params.quoteResponse,
                userPublicKey: params.userPublicKey,
                wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
            }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || error.description || "Failed to fetch swap transaction");
        }

        const data = await res.json();
        return data.swapTransaction; // Base64 encoded transaction
    }
}

// Export instance for convenience (methods are static, so this works)
export const jupiterClient = {
    getQuote: JupiterClient.getQuote,
    getSwapTransaction: JupiterClient.getSwapTransaction,
};
