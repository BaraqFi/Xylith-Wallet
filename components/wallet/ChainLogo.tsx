
import { type ComponentType } from "react";
import { EVMChain } from "./data";
// Web3Icons for network high-quality logos
import {
    NetworkEthereum,
    NetworkBinanceSmartChain,
    NetworkBase,
    NetworkArbitrumOne,
    NetworkOptimism,
    NetworkPolygon,
    NetworkSolana,
} from "@web3icons/react";

export function ChainLogo({ chain }: { chain: EVMChain | "solana" }) {
    // Map chain names to Web3Icons Network component names
    const networkIconMap: Record<string, string> = {
        ethereum: "NetworkEthereum",
        bsc: "NetworkBinanceSmartChain",
        base: "NetworkBase",
        arbitrum: "NetworkArbitrumOne",
        optimism: "NetworkOptimism",
        polygon: "NetworkPolygon",
        solana: "NetworkSolana",
    };

    const iconName = networkIconMap[chain];
    // Map network icon names to actual components for better tree-shaking
    const networkComponentMap: Record<string, ComponentType<any>> = {
        NetworkEthereum,
        NetworkBinanceSmartChain,
        NetworkBase,
        NetworkArbitrumOne,
        NetworkOptimism,
        NetworkPolygon,
        NetworkSolana,
    };
    const IconComponent = iconName ? networkComponentMap[iconName] : null;

    if (IconComponent) {
        return (
            <div className="flex h-4 w-4 items-center justify-center overflow-hidden" title={chain}>
                <IconComponent variant="branded" size={16} className="h-4 w-4" />
            </div>
        );
    }

    // Fallback
    const chainColors: Record<string, string> = {
        ethereum: "bg-blue-500",
        bsc: "bg-yellow-500",
        base: "bg-blue-400",
        arbitrum: "bg-cyan-500",
        optimism: "bg-red-500",
        polygon: "bg-purple-500",
        solana: "bg-purple-400",
    };

    const chainInitials: Record<string, string> = {
        ethereum: "ETH",
        bsc: "BSC",
        base: "BASE",
        arbitrum: "ARB",
        optimism: "OP",
        polygon: "MATIC",
        solana: "SOL",
    };

    return (
        <div
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${chainColors[chain] || "bg-gray-500"}`}
            title={chain}
        >
            {chainInitials[chain]?.[0] || "?"}
        </div>
    );
}
