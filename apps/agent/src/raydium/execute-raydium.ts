import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ─── Known pools ──────────────────────────────────────────────────────────────

export const RAYDIUM_POOLS: Record<string, string> = {
    "SOL-USDC-CPMM": "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny",
    "SOL-USDC-AMM": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    "SOL-USDC-CLMM": "DnmohzP5x6hJGDpTAEXPwcDnwJoZKjTrfcXKaWG99XYh",
    "RAY-USDC-AMM": "6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg",
};

export const DEFAULT_POOL = RAYDIUM_POOLS["SOL-USDC-AMM"];
export const DEFAULT_POOL_TYPE: "cpmm" | "clmm" | "amm" = "amm";

export const VERIFIED_TOKENS: Record<string, { mint: string; decimals: number }> = {
    SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
    USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
    RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6 },
    BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd", decimals: 5 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaydiumOp =
    | "swap"
    | "add_liquidity"
    | "remove_liquidity"
    | "status";

export interface RaydiumDecision {
    action: RaydiumOp | "reject";
    poolId?: string;
    poolType?: "cpmm" | "clmm" | "amm";
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: number;
    amountOut?: number;
    slippage?: number;
    baseIn?: boolean;   // for add_liquidity: true = amount is tokenA side
    lpAmount?: number;    // for remove_liquidity
    reason?: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function executeRaydiumTask(
    instruction: string
): Promise<RaydiumDecision> {
    const tokenList = Object.keys(VERIFIED_TOKENS).join(", ");
    const poolList = Object.entries(RAYDIUM_POOLS)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

    const system = `You are a DeFi agent parser for Raydium AMM operations on Solana.

Raydium has three pool types:
- CPMM: Simple constant product, no OpenBook required, supports Token22
- CLMM: Concentrated liquidity with price ranges (NFT positions)  
- AMM: Classic AMM with OpenBook orderbook integration

Supported tokens: ${tokenList}

Available pools:
${poolList}

Default pool: SOL-USDC-CPMM (${DEFAULT_POOL})

Respond ONLY with a JSON object. No markdown. No explanation. Start with { end with }.

For swap:
{"action":"swap","poolId":"${DEFAULT_POOL}","poolType":"cpmm","tokenIn":"SOL","tokenOut":"USDC","amountIn":0.001,"slippage":0.01}

For add_liquidity (CPMM):
{"action":"add_liquidity","poolId":"${DEFAULT_POOL}","poolType":"cpmm","amountIn":1000000,"baseIn":true,"slippage":0.01}

For remove_liquidity (CPMM):
{"action":"remove_liquidity","poolId":"${DEFAULT_POOL}","poolType":"cpmm","lpAmount":500000,"slippage":0.01}

For status:
{"action":"status","poolId":"${DEFAULT_POOL}","poolType":"cpmm"}

For out-of-scope:
{"action":"reject","reason":"one sentence"}

Rules:
- amountIn for swap is in token units (not lamports) — e.g. 0.001 SOL
- amountIn for add_liquidity is in base units (lamports)
- lpAmount for remove_liquidity is in base units
- If no pool specified use SOL-USDC-CPMM
- Do NOT reject based on amount size`;

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
        return JSON.parse(raw.slice(start, end + 1)) as RaydiumDecision;
    } catch {
        throw new Error(`Parse failed: ${raw}`);
    }
}