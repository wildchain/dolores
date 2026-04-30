import Anthropic from "@anthropic-ai/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Raydium, TxVersion, Percent } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";


const client = new Anthropic();

// ─── Known pools ──────────────────────────────────────────────────────────────

export const RAYDIUM_POOLS: Record<string, string> = {
    "SOL-USDC-CPMM": "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny",
    "SOL-USDC-AMM": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    "SOL-USDC-CLMM": "DnmohzP5x6hJGDpTAEXPwcDnwJoZKjTrfcXKaWG99XYh",
    "RAY-USDC-AMM": "6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg",
};

export const DEFAULT_POOL = RAYDIUM_POOLS["SOL-USDC-CPMM"];
export const DEFAULT_POOL_TYPE: "cpmm" | "clmm" | "amm" = "cpmm";

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

export interface RaydiumExecutionResult {
    action: string;
    txSignature?: string;
    reason?: string;
}

export async function executeRaydiumAction(
    agentKeypair: Keypair,
    decision: RaydiumDecision,
): Promise<RaydiumExecutionResult> {
    if (decision.action === "reject" || decision.action === "status") {
        return { action: decision.action, reason: decision.reason };
    }

    const connection = new Connection(
        process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
    );

    const raydium = await Raydium.load({
        connection,
        owner: agentKeypair,
        cluster: "mainnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: "confirmed",
    });

    const poolId = decision.poolId ?? DEFAULT_POOL;
    const poolType = decision.poolType ?? DEFAULT_POOL_TYPE;

    // Fetch pool info from Raydium API
    const poolData = await raydium.api.fetchPoolById({ ids: poolId });
    if (!poolData || !poolData[0]) {
        throw new Error(`Pool ${poolId} not found or wrong pool type`);
    }
    const poolInfo = poolData[0] as any;

    switch (decision.action) {
        case "swap": {
            const tokenInInfo = VERIFIED_TOKENS[decision.tokenIn ?? "SOL"];
            const inAmountLamports = new BN(
                Math.floor((decision.amountIn ?? 0) * Math.pow(10, tokenInInfo.decimals))
            );
            const baseIn = decision.tokenIn === poolInfo.mintA.address ||
                decision.tokenIn === "SOL";

            const { transaction } = await raydium.cpmm.swap({
                poolInfo,
                baseIn,
                inputAmount: inAmountLamports,
                swapResult: { inputAmount: inAmountLamports, outputAmount: new BN(0) },
                slippage: decision.slippage ?? 0.01,
                txVersion: TxVersion.V0,
                computeBudgetConfig: {
                    units: 600000,
                    microLamports: 50000,
                },
            });

            let txId: string | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
                    transaction.message.recentBlockhash = blockhash;
                    transaction.sign([agentKeypair]);
                    txId = await connection.sendTransaction(transaction, { skipPreflight: true, maxRetries: 5 });
                    await connection.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, "confirmed");
                    break;
                } catch (retryErr: any) {
                    if (attempt === 2) throw retryErr;
                    console.log(`   ⏳ Retry ${attempt + 1}/3...`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            return { action: "swap", txSignature: txId! };
        }

        case "add_liquidity": {
            const inputAmount = new BN(decision.amountIn ?? 1000000);
            const slippage = new Percent(1, 100); // 1%
            const { execute } = await raydium.cpmm.addLiquidity({
                poolInfo,
                inputAmount,
                baseIn: decision.baseIn ?? true,
                slippage,
                txVersion: TxVersion.V0,
            });
            const { txId } = await execute({ sendAndConfirm: true, skipPreflight: true });
            return { action: "add_liquidity", txSignature: txId };
        }

        case "remove_liquidity": {
            const lpAmount = new BN(decision.lpAmount ?? 0);
            const slippage = new Percent(1, 100);
            const { execute } = await raydium.cpmm.withdrawLiquidity({
                poolInfo,
                lpAmount,
                slippage,
                txVersion: TxVersion.V0,
            });
            const { txId } = await execute({ sendAndConfirm: true, skipPreflight: true });
            return { action: "remove_liquidity", txSignature: txId };
        }

        default:
            throw new Error(`Unknown Raydium action: ${decision.action}`);
    }
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