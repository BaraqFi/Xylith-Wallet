import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { AICommand, Transaction } from "./types";

const MODEL_NAME = "gemini-2.5-flash";

let cachedAi: GoogleGenAI | null = null;

function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
}

function getAiClient(): GoogleGenAI {
  if (cachedAi) return cachedAi;
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  cachedAi = new GoogleGenAI({ apiKey });
  return cachedAi;
}

const systemInstruction = `
You are the KERNEL of Xylith AI, an advanced blockchain operating system.
Input: Natural language user commands.
Output: Precise JSON execution instructions.

Persona:
- You are NOT a chat bot. You are a system interface.
- Be concise. Use technical terminology.

Capabilities & Rules:

1. NATIVE SWAPS (Same Chain):
   - "Swap SOL to USDC" -> Intent: SWAP, Chain: SOL, TargetToken: USDC.
   - "Swap ETH to DAI" -> Intent: SWAP, Chain: ETH, TargetToken: DAI.
   - "Swap {Token} to {CA}" -> If CA matches the current chain format, it is a Native Swap.

2. CROSS-CHAIN / BRIDGE (Different Chains):
   - Explicit: "Swap SOL to ETH on Ethereum" -> Intent: BRIDGE, Chain: SOL, TargetChain: ETH, TargetToken: ETH.
   - Explicit: "Swap ETH to SOL on Solana" -> Intent: BRIDGE, Chain: ETH, TargetChain: SOL, TargetToken: SOL.
   - Implicit by Address: 
     - "Swap ETH to {Base58_Address}" (Solana addr) -> Intent: BRIDGE, Chain: ETH, TargetChain: SOL.
     - "Swap SOL to {0x_Address}" (EVM addr) -> Intent: BRIDGE, Chain: SOL, TargetChain: ETH.
   - Implicit by Token:
     - "Swap ETH to WIF" (WIF is Solana native) -> Intent: BRIDGE, Chain: ETH, TargetChain: SOL, TargetToken: WIF.

3. TRANSACTION HISTORY:
   - "Show history" -> Intent: HISTORY, Limit: 5 (Default). Chain: null (Implies all).
   - "History for Solana" -> Intent: HISTORY, Chain: SOL.
   - "Last 10 txs on ETH" -> Intent: HISTORY, Chain: ETH, Limit: 10.
   - "Check history for {Address}" -> Intent: HISTORY, Recipient: {Address}. Detect Chain from address format.
   - "Show history for {Address} on {Chain}" -> Intent: HISTORY, Chain: {Chain}, Recipient: {Address}.
   - Map full names: "Ethereum"->ETH, "Solana"->SOL, "Arbitrum"->ARB.

4. BUY / SELL ACTIONS:
   - "Buy {CA}" -> Detect chain from CA. If Base58 -> Chain: SOL. If 0x -> Chain: ETH (default) or BASE/ARB if specified.
   - If no amount specified, leave amountUSD null (app defaults).

5. RISK_ASSESSMENT:
   - "HIGH" if interacting with new contracts or sending > $500.
   - "MEDIUM" if sending > $100.
   - "LOW" otherwise.

Return JSON matching the schema.
`;

export const parseUserCommand = async (
  userText: string,
  userWallet: { evmAddress: string; solAddress: string }
): Promise<AICommand> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Context: { EVM: ${userWallet.evmAddress}, SOL: ${userWallet.solAddress} }. Input: ${userText}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ['SEND', 'SWAP', 'BRIDGE', 'BALANCE', 'CHAT', 'HISTORY', 'HISTORY_SUMMARY'] },
            chain: { type: Type.STRING, enum: ['ETH', 'BASE', 'ARB', 'SOL'], nullable: true },
            targetChain: { type: Type.STRING, enum: ['ETH', 'BASE', 'ARB', 'SOL'], nullable: true },
            amountUSD: { type: Type.NUMBER, nullable: true },
            limit: { type: Type.NUMBER, nullable: true },
            token: { type: Type.STRING, nullable: true },
            targetToken: { type: Type.STRING, nullable: true },
            recipient: { type: Type.STRING, nullable: true },
            contractAddress: { type: Type.STRING, nullable: true },
            reply: { type: Type.STRING, description: "System status message." },
            reasoning: { type: Type.STRING, description: "Internal logic hash." },
            riskAssessment: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
            technicalSummary: { type: Type.STRING }
          },
          required: ['intent', 'reply', 'reasoning', 'riskAssessment', 'technicalSummary']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AICommand;
    }

    throw new Error("KERNEL_NO_RESPONSE");
  } catch (error) {
    console.error("Gemini Kernel Panic:", error);
    return {
      intent: 'CHAT',
      reply: "KERNEL PANIC :: CONNECTION SEVERED",
      reasoning: "API_FAILURE",
      riskAssessment: 'LOW',
      technicalSummary: "System Error"
    };
  }
};

export const summarizeHistory = async (history: Transaction[]): Promise<string> => {
  if (history.length === 0) return "LOG_EMPTY";
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate a system log summary for: ${JSON.stringify(history.slice(-10))}`,
    });
    return response.text || "SUMMARY_FAILED";
  } catch {
    return "SUMMARY_UNAVAILABLE";
  }
};
