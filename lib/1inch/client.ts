import { Quote, SwapResponse } from "./types";

export interface OneInchQuoteParams {
    src: string;
    dst: string;
    amount: string;
    chainId: number;
}

export interface OneInchSwapParams extends OneInchQuoteParams {
    from: string;
    slippage: number;
    disableEstimate?: boolean;
}

export class OneInchClient {
    private static BASE_URL = "/api/1inch";

    static async getQuote(params: OneInchQuoteParams): Promise<Quote> {
        const searchParams = new URLSearchParams({
            src: params.src,
            dst: params.dst,
            amount: params.amount,
            chainId: params.chainId.toString(),
        });

        const res = await fetch(`${this.BASE_URL}/quote?${searchParams}`);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.description || "Failed to fetch quote");
        }
        return res.json();
    }

    static async getSwap(params: OneInchSwapParams): Promise<SwapResponse> {
        const searchParams = new URLSearchParams({
            src: params.src,
            dst: params.dst,
            amount: params.amount,
            from: params.from,
            slippage: params.slippage.toString(),
            chainId: params.chainId.toString(),
            disableEstimate: params.disableEstimate ? "true" : "false",
        });

        const res = await fetch(`${this.BASE_URL}/swap?${searchParams}`);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.description || "Failed to fetch swap calldata");
        }
        return res.json();
    }
}
