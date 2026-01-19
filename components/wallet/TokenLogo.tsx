import { ComponentType } from "react";
import {
    TokenETH,
    TokenUSDC,
    TokenUSDT,
    TokenWBTC,
    TokenDAI,
    TokenARB,
    TokenOP,
    TokenMATIC,
    TokenBNB,
    TokenSOL,
    TokenRAY,
    TokenJUP,
} from "@web3icons/react";

export interface TokenLogoProps {
    symbol: string;
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    src?: string;
    className?: string;
}

export function TokenLogo({
    symbol,
    name,
    size = "md",
    src,
    className = "",
}: TokenLogoProps) {
    // Map token symbols to Web3Icons component names
    const tokenIconMap: Record<string, string> = {
        ETH: "TokenETH",
        USDC: "TokenUSDC",
        USDT: "TokenUSDT",
        WBTC: "TokenWBTC",
        DAI: "TokenDAI",
        ARB: "TokenARB",
        OP: "TokenOP",
        MATIC: "TokenMATIC",
        BNB: "TokenBNB",
        SOL: "TokenSOL",
        RAY: "TokenRAY",
        JUP: "TokenJUP",
    };

    const sizeMap = {
        xs: { container: "h-5 w-5", icon: 16, text: "text-[10px]" },
        sm: { container: "h-6 w-6", icon: 24, text: "text-xs" },
        md: { container: "h-10 w-10", icon: 40, text: "text-sm" },
        lg: { container: "h-12 w-12", icon: 48, text: "text-base" },
    };

    const sizes = sizeMap[size];

    // 1. Try Remote Image if src provided
    if (src) {
        return (
            <div className={`relative flex ${sizes.container} items-center justify-center rounded-full overflow-hidden bg-[color:var(--color-surface)] ${className}`}>
                <img
                    src={src}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
        );
    }

    // 2. Try Web3Icons
    const iconName = tokenIconMap[symbol];
    const iconComponentMap: Record<string, ComponentType<any>> = {
        TokenETH,
        TokenUSDC,
        TokenUSDT,
        TokenWBTC,
        TokenDAI,
        TokenARB,
        TokenOP,
        TokenMATIC,
        TokenBNB,
        TokenSOL,
        TokenRAY,
        TokenJUP,
    };
    const IconComponent = iconName ? iconComponentMap[iconName] : null;

    if (IconComponent) {
        return (
            <div className={`flex ${sizes.container} items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 ${className}`}>
                <IconComponent variant="branded" size={sizes.icon} />
            </div>
        );
    }

    // 3. Fallback to Initial
    return (
        <div className={`flex ${sizes.container} items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold ${sizes.text} text-[color:var(--color-accent)] ${className}`}>
            {symbol[0] || name[0] || "?"}
        </div>
    );
}
