export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
}

export interface Quote {
    dstAmount: string;
    gasPrice: string;
    gas: number;
    protocols: any[];
}

export interface SwapResponse {
    dstAmount: string;
    tx: {
        from: string;
        to: string;
        data: string;
        value: string;
        gasPrice: string;
        gas: number;
    };
}
