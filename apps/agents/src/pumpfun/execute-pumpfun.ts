import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ─── Program IDs ──────────────────────────────────────────────────────────────

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_FEES_ID = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PumpOp = "buy" | "sell" | "status";

export interface PumpDecision {
    action: PumpOp | "reject";
    mint?: string;   // token mint address
    solAmount?: number;  // SOL to spend (for buy)
    tokenAmount?: number; // tokens to sell (for sell)
    slippageBps?: number;
    reason?: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function executePumpFunTask(
    instruction: string
): Promise<PumpDecision> {
    const system = `You are a DeFi agent parser for PumpFun bonding curve operations on Solana.

PumpFun is a token launch platform where tokens trade on bonding curves until they graduate to PumpSwap AMM.

Supported operations:
- buy: Buy tokens from a bonding curve using SOL
- sell: Sell tokens back to a bonding curve for SOL
- status: Check bonding curve state (price, reserves, graduation progress)

Respond ONLY with a JSON object. No markdown. No explanation. Start with { end with }.

For buy (solAmount in SOL, not lamports):
{"action":"buy","mint":"TOKEN_MINT_ADDRESS","solAmount":0.01,"slippageBps":500}

For sell (tokenAmount in raw token units):
{"action":"sell","mint":"TOKEN_MINT_ADDRESS","tokenAmount":1000000,"slippageBps":500}

For status check:
{"action":"status","mint":"TOKEN_MINT_ADDRESS"}

For out-of-scope:
{"action":"reject","reason":"one sentence"}

Rules:
- mint must be a valid Solana public key provided by the user
- solAmount is in SOL (e.g. 0.01 = 0.01 SOL)
- tokenAmount is in raw units (already multiplied by decimals)
- Default slippage is 500 bps (5%) for meme tokens
- Do NOT reject based on amount size
- If no mint address provided, reject with reason asking for mint address`;

    const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system,
        messages: [{ role: "user", content: instruction }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");

    const raw = textBlock.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error(`No JSON in: ${raw}`);

    try {
        return JSON.parse(raw.slice(start, end + 1)) as PumpDecision;
    } catch {
        throw new Error(`Parse failed: ${raw}`);
    }
}