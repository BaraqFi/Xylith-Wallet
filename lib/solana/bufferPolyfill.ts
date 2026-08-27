import { Buffer } from "buffer";

/**
 * @solana/web3.js and @solana/spl-token use the Node `Buffer` global internally
 * (Transaction.serialize, instruction encoding). Browsers don't provide one, so
 * Solana transactions throw "Buffer is not defined" at signing time while EVM
 * paths — which never touch it — work fine.
 *
 * Imported for its side effect from the client provider so it runs before any
 * Solana code does.
 */
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (typeof globalThis !== "undefined" && !g.Buffer) {
  g.Buffer = Buffer;
}

export {};
