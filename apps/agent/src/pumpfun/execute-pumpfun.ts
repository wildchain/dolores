import Anthropic from "@anthropic-ai/sdk";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { PumpSdk, OnlinePumpSdk, getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

import BN from "bn.js";

const client = new Anthropic();

// Program IDs 

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_FEES_ID = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";

//  Types 

export type PumpOp = "buy" | "sell" | "status";

export interface PumpDecision {
    action: PumpOp | "reject";
    mint?: string;
    solAmount?: number;
    tokenAmount?: number;
    slippageBps?: number;
    reason?: string;
}

export interface PumpExecutionResult {
    action: string;
    txSignature?: string;
    reason?: string;
}

//  Helpers 

async function detectTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
    const mintInfo = await connection.getAccountInfo(mint);
    if (!mintInfo) throw new Error(`Mint ${mint.toBase58()} not found`);
    return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

//  Execution 

export async function executePumpFunAction(
    agentKeypair: Keypair,
    decision: PumpDecision,
): Promise<PumpExecutionResult> {
    if (decision.action === "reject" || decision.action === "status") {
        return { action: decision.action, reason: decision.reason };
    }

    if (!decision.mint) {
        throw new Error("mint required for buy/sell");
    }

    const connection = new Connection(
        process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
    );

    const sdk = new PumpSdk();
    const onlineSdk = new OnlinePumpSdk(connection);
    const mint = new PublicKey(decision.mint);
    const user = agentKeypair.publicKey;
    const slippagePct = (decision.slippageBps ?? 500) / 100;

    let instructions: TransactionInstruction[];

    if (decision.action === "buy") {
        const solAmount = new BN(Math.floor((decision.solAmount ?? 0.001) * 1e9));

        const [global, feeConfig, buyState] = await Promise.all([
            onlineSdk.fetchGlobal(),
            onlineSdk.fetchFeeConfig(),
            onlineSdk.fetchBuyState(mint, user),
        ]);
        const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = buyState;

        if (bondingCurve.complete) {
            throw new Error("Bonding curve graduated — use PumpSwap AMM");
        }

        const tokenAmount = getBuyTokenAmountFromSolAmount({
            global,
            feeConfig,
            mintSupply: bondingCurve.tokenTotalSupply,
            bondingCurve,
            amount: solAmount,
        });

        // fetchBuyState auto-detects tokenProgram
        const tokenProgram = await detectTokenProgram(connection, mint);

        instructions = await sdk.buyInstructions({
            global,
            bondingCurveAccountInfo,
            bondingCurve,
            associatedUserAccountInfo,
            mint,
            user,
            solAmount,
            amount: tokenAmount,
            slippage: slippagePct,
            tokenProgram,
        });

    } else {
        // sell
        const tokenAmount = new BN(decision.tokenAmount ?? 0);

        const [global, feeConfig, sellState, tokenProgram] = await Promise.all([
            onlineSdk.fetchGlobal(),
            onlineSdk.fetchFeeConfig(),
            onlineSdk.fetchSellState(mint, user),
            detectTokenProgram(connection, mint),
        ]);
        const { bondingCurveAccountInfo, bondingCurve } = sellState;

        if (bondingCurve.complete) {
            throw new Error("Bonding curve graduated — use PumpSwap AMM");
        }

        const solAmount = getSellSolAmountFromTokenAmount({
            global,
            feeConfig,
            mintSupply: bondingCurve.tokenTotalSupply,
            bondingCurve,
            amount: tokenAmount,
        });

        instructions = await sdk.sellInstructions({
            global,
            bondingCurveAccountInfo,
            bondingCurve,
            mint,
            user,
            amount: tokenAmount,
            solAmount,
            slippage: slippagePct,
            tokenProgram,
            mayhemMode: false,
        });
    }

    const tx = new Transaction().add(...instructions);
    const txId = await sendAndConfirmTransaction(connection, tx, [agentKeypair], {
        commitment: "confirmed",
        skipPreflight: true,
    });

    return { action: decision.action, txSignature: txId };
}

// Main 

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