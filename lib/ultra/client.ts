interface UltraOrderParams {
    inputMint: string;
    outputMint: string;
    amount: string; // Atomic units (e.g. lamports)
    taker?: string; // Solana address (optional but recommended)
    referralAccount?: string;
    referralFee?: number; // bps
}

interface UltraExecuteParams {
    signedTransaction: string; // base64
    requestId: string;
}

export class UltraClient {
    private static BASE_URL = "/api/ultra";

    static async getOrder(params: UltraOrderParams) {
        const searchParams = new URLSearchParams({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: params.amount,
        });

        if (params.taker) {
            searchParams.append("taker", params.taker);
        }

        if (params.referralAccount) {
            searchParams.append("referralAccount", params.referralAccount);
        }

        if (typeof params.referralFee === "number") {
            searchParams.append("referralFee", params.referralFee.toString());
        }

        const res = await fetch(`${this.BASE_URL}/order?${searchParams}`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(
                data?.error || data?.description || "Failed to fetch Ultra order",
            );
        }

        return data;
    }

    static async executeOrder(params: UltraExecuteParams) {
        const res = await fetch(`${this.BASE_URL}/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                signedTransaction: params.signedTransaction,
                requestId: params.requestId,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(
                data?.error || data?.description || "Failed to execute Ultra order",
            );
        }

        return data;
    }
}

export const ultraClient = {
    getOrder: (params: UltraOrderParams) => UltraClient.getOrder(params),
    executeOrder: (params: UltraExecuteParams) => UltraClient.executeOrder(params),
};

