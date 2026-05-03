import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ─── Known SOL/USDC DLMM pools on mainnet ────────────────────────────────────
// Fee tiers: 1bps, 2bps, 5bps, 10bps, 20bps, 25bps, 100bps, 200bps, 400bps
export const DLMM_POOLS: Record<string, string> = {
    "SOL-USDC-1": "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ", // 1bps
    "SOL-USDC-5": "3W2HKgUa96Z69zzucHMFGPxRQsNZMdngQp3XJbhVEFyR", // 5bps
    "SOL-USDC-10": "C1MgLojNLWBKADvu9BHdtgzz1oZX4dZ5zGdGcgvvW8Wz", // 10bps
    "SOL-USDC-25": "FoSDw2L5DmTuQTFe55gWPDXf88euaxAEKFre74CnvQbX", // 25bps (default)
    "SOL-USDC-100": "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9jpTUAApCYw4enx", // 100bps
};

export const DEFAULT_POOL = DLMM_POOLS["SOL-USDC-25"];

export const VERIFIED_TOKENS: Record<string, { mint: string; decimals: number }> = {
    SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
    USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe", decimals: 6 },
    BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd", decimals: 5 },
    JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeteoraOp =
    | "add_liquidity"
    | "remove_liquidity"
    | "swap"
    | "collect_fees"
    | "status";

export interface MeteoraDecision {
    action: MeteoraOp | "reject";
    tokenX?: string;
    tokenY?: string;
    amountX?: number;
    amountY?: number;
    binRange?: number;
    poolAddress?: string;
    bps?: number;      // for remove_liquidity: 0-10000 (10000 = 100%)
    reason?: string;      // for reject
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function executeMeteoraTask(
    instruction: string
): Promise<MeteoraDecision> {
    const tokenList = Object.keys(VERIFIED_TOKENS).join(", ");
    const poolList = Object.entries(DLMM_POOLS)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

    const system = `You are a DeFi agent parser for Meteora DLMM liquidity operations.

Meteora DLMM is a concentrated liquidity AMM on Solana. Agents can:
1. Add liquidity to a DLMM pool (provide tokens around active price bin)
2. Remove liquidity from their position
3. Swap tokens through a DLMM pool
4. Collect swap fees from their position
5. Check position status

Supported tokens: ${tokenList}

Available pools:
${poolList}

Default pool: SOL-USDC-25 (${DEFAULT_POOL})

Respond ONLY with a JSON object. No markdown. No explanation. Start with { end with }.

For add_liquidity:
{"action":"add_liquidity","tokenX":"SOL","tokenY":"USDC","amountX":0.01,"amountY":1.5,"binRange":10,"poolAddress":"${DEFAULT_POOL}"}

For remove_liquidity (bps 0-10000, 10000=100%):
{"action":"remove_liquidity","bps":10000,"poolAddress":"${DEFAULT_POOL}"}

For swap:
{"action":"swap","tokenX":"SOL","tokenY":"USDC","amountX":0.001,"poolAddress":"${DEFAULT_POOL}"}

For collect_fees:
{"action":"collect_fees","poolAddress":"${DEFAULT_POOL}"}

For status check:
{"action":"status"}

For out-of-scope:
{"action":"reject","reason":"one sentence"}

Rules:
- Only reject if genuinely out of scope (not a DLMM operation)
- Do NOT reject based on amount size
- If no pool specified, use default SOL-USDC-25 pool
- binRange default is 10 (10 bins each side of active bin)`;

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
        return JSON.parse(raw.slice(start, end + 1)) as MeteoraDecision;
    } catch {
        throw new Error(`Parse failed: ${raw}`);
    }
}