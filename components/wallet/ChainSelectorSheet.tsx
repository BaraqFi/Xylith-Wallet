
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Check } from "lucide-react";
import { ChainLogo } from "./ChainLogo";
import { SUPPORTED_CHAINS, EVMChain, Chain, TokenBalance } from "./data";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

interface ChainSelectorSheetProps {
    selectedChain: Chain;
    selectedEvmChain?: EVMChain | "all"; // "all" for homepage filter
    onSelectChain: (chain: Chain, evmChain?: EVMChain | "all") => void;
    tokens?: TokenBalance[]; // For calculating totals
    includeAllOption?: boolean;
    trigger: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ChainSelectorSheet({
    selectedChain,
    selectedEvmChain,
    onSelectChain,
    tokens = [],
    includeAllOption = false,
    trigger,
    open: externalOpen,
    onOpenChange: externalOnOpenChange,
}: ChainSelectorSheetProps) {
    // Internal state for uncontrolled mode if needed, but we prefer relying on external or just Sheet primitive
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = externalOpen !== undefined;
    const showOpen = isControlled ? externalOpen : internalOpen;
    const setShowOpen = isControlled ? externalOnOpenChange! : setInternalOpen;

    const handleSelect = (chain: Chain, evmChain?: EVMChain | "all") => {
        onSelectChain(chain, evmChain);
        setShowOpen(false); // Auto-close
    };

    const getChainTotalValue = (chainLabel: string, chainType: Chain, chainValue: string | EVMChain) => {
        if (!tokens.length) return 0;
        return tokens
            .filter(t => {
                if (chainType === "Solana") return t.chain === "Solana";
                return t.chain === "EVM" && t.evmChain === chainValue;
            })
            .reduce((sum, t) => sum + (t.usdValue || 0), 0);
    };

    // Calculate All Networks Total
    const allTotal = tokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);
    // Actually, "All Networks" in homepage context usually means All EVM or All (EVM+Solana).
    // If includeAllOption is true, we usually mean "All EVM" if the filter context is EVM.
    // But let's assume "All" means everything passed in 'tokens'.

    return (
        <Sheet open={showOpen} onOpenChange={setShowOpen}>
            <SheetTrigger asChild>
                {trigger}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 pb-10">
                <SheetHeader className="p-6 border-b border-[color:var(--color-border)]">
                    <div className="flex items-center justify-between">
                        <SheetTitle>Select Network</SheetTitle>
                    </div>
                </SheetHeader>
                <div className="p-4 grid gap-2 max-h-[70dvh] overflow-y-auto">
                    {includeAllOption && (
                        <Button
                            key="all-networks"
                            variant="ghost"
                            className={`w-full justify-between h-14 text-lg font-normal ${selectedEvmChain === "all" ? "bg-[color:var(--color-depth)]/10" : ""}`}
                            onClick={() => handleSelect("EVM", "all")}
                        >
                            <div className="flex items-center gap-3">
                                {/* Maybe a globe icon or similar for All? Using Ethereum logo as generic or nothing */}
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-surface)] shadow-sm">
                                    <span className="text-xs font-bold">ALL</span>
                                </div>
                                <span>All Networks</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-[color:var(--color-depth)]/60">
                                    ${allTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {selectedEvmChain === "all" && (
                                    <Check className="h-5 w-5 text-[color:var(--color-accent)]" />
                                )}
                            </div>
                        </Button>
                    )}

                    {SUPPORTED_CHAINS.map((chain) => {
                        // Determine if selected
                        // If selecting logic involves types:
                        const isSelected =
                            selectedChain === chain.type &&
                            (!chain.value || selectedEvmChain === chain.value || (chain.type === 'Solana' && chain.value === 'solana'));

                        const chainTotal = getChainTotalValue(chain.label, chain.type, chain.value);

                        return (
                            <Button
                                key={chain.label}
                                variant="ghost"
                                className={`w-full justify-between h-14 text-lg font-normal ${isSelected ? "bg-[color:var(--color-depth)]/10" : ""
                                    }`}
                                onClick={() => {
                                    handleSelect(chain.type, chain.type === "EVM" ? (chain.value as EVMChain) : undefined);
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <ChainLogo chain={chain.value} />
                                    <span>{chain.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-[color:var(--color-depth)]/60">
                                        ${chainTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {isSelected && (
                                        <Check className="h-5 w-5 text-[color:var(--color-accent)]" />
                                    )}
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    );
}
