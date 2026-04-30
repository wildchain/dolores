import Anthropic from "@anthropic-ai/sdk";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
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

//  Types 

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

    // Use Trade API for swaps (pure HTTP, fastest path to mainnet inclusion)
    if (decision.action === "swap") {
        const tokenInInfo = VERIFIED_TOKENS[decision.tokenIn ?? "SOL"];
        const tokenOutInfo = VERIFIED_TOKENS[decision.tokenOut ?? "USDC"];
        const inAmountLamports = Math.floor(
            (decision.amountIn ?? 0) * Math.pow(10, tokenInInfo.decimals)
        );
        const slippageBps = Math.floor((decision.slippage ?? 0.01) * 10000);

        // 1. Get priority fee
        const feeRes = await fetch("https://transaction-v1.raydium.io/priority-fee");
        const feeText = await feeRes.text();
        let computeUnitPriceMicroLamports = "10000"; // fallback
        try {
            const feeData = JSON.parse(feeText);
            computeUnitPriceMicroLamports = String(feeData.data.default.h);
        } catch {
            console.warn(`   ⚠️  Priority fee fetch failed, using fallback`);
        }

        // 2. Get swap quote
        const quoteUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${tokenInInfo.mint}&outputMint=${tokenOutInfo.mint}&amount=${inAmountLamports}&slippageBps=${slippageBps}&txVersion=V0`;
        console.log(`   Quote URL: ${quoteUrl}`);
        const quoteRes = await fetch(quoteUrl);
        const quoteText = await quoteRes.text();
        console.log(`   Quote status: ${quoteRes.status}, body: ${quoteText.slice(0, 200)}`);
        const quoteData = JSON.parse(quoteText);
        if (!quoteData.success) {
            throw new Error(`Raydium quote failed: ${JSON.stringify(quoteData)}`);
        }

        // 3. Build transaction
        const txRes = await fetch("https://transaction-v1.raydium.io/transaction/swap-base-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                computeUnitPriceMicroLamports,
                swapResponse: quoteData,
                txVersion: "V0",
                wallet: agentKeypair.publicKey.toBase58(),
                wrapSol: decision.tokenIn === "SOL",
                unwrapSol: decision.tokenOut === "SOL",
            }),
        });
        const txText = await txRes.text();
        console.log(`   TX build status: ${txRes.status}, body: ${txText.slice(0, 200)}`);
        const txData = JSON.parse(txText);
        if (!txData.success) {
            throw new Error(`Raydium tx build failed: ${JSON.stringify(txData)}`);
        }

        // 4. Sign and send
        const txBuf = Buffer.from(txData.data[0].transaction, "base64");
        const tx = VersionedTransaction.deserialize(txBuf);

        // Get fresh blockhash before sending
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.message.recentBlockhash = blockhash;

        tx.sign([agentKeypair]);

        const txId = await connection.sendTransaction(tx, {
            skipPreflight: true,
            maxRetries: 5,
            preflightCommitment: "confirmed"
        });
        console.log(`   📤 Sent: ${txId}`);

        // Poll status manually with longer timeout
        const start = Date.now();
        const TIMEOUT_MS = 90_000;
        while (Date.now() - start < TIMEOUT_MS) {
            const status = await connection.getSignatureStatus(txId);
            if (status?.value?.confirmationStatus === "confirmed" || status?.value?.confirmationStatus === "finalized") {
                if (status.value.err) {
                    throw new Error(`TX failed: ${JSON.stringify(status.value.err)}`);
                }
                return { action: "swap", txSignature: txId };
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        throw new Error(`Confirmation timeout for ${txId}`);
    }

    // Liquidity ops still use SDK (Trade API doesn't support them)
    const raydium = await Raydium.load({
        connection,
        owner: agentKeypair,
        cluster: "mainnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: "finalized",
    });

    const poolId = decision.poolId ?? DEFAULT_POOL;
    const poolData = await raydium.api.fetchPoolById({ ids: poolId });
    if (!poolData || !poolData[0]) {
        throw new Error(`Pool ${poolId} not found`);
    }
    const poolInfo = poolData[0] as any;

    switch (decision.action) {
        case "add_liquidity": {
            const inputAmount = new BN(decision.amountIn ?? 1000000);
            const slippage = new Percent(1, 100);
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