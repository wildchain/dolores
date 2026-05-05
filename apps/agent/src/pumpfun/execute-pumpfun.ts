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
        let tokenAmount = new BN(decision.tokenAmount ?? 0);

        const tokenProgram = await detectTokenProgram(connection, mint);
        const [global, feeConfig, sellState] = await Promise.all([
            onlineSdk.fetchGlobal(),
            onlineSdk.fetchFeeConfig(),
            onlineSdk.fetchSellState(mint, user, tokenProgram),
        ]);
        const { bondingCurveAccountInfo, bondingCurve } = sellState;

        if (bondingCurve.complete) {
            throw new Error("Bonding curve graduated — use PumpSwap AMM");
        }

        // Check actual token balance and cap sell amount
        const tokenAccounts = await connection.getTokenAccountsByOwner(user, { mint });
        if (tokenAccounts.value.length === 0) {
            throw new Error(`Agent has no token account for ${mint.toBase58().slice(0, 8)}...`);
        }
        const { AccountLayout } = await import("@solana/spl-token");
        const ataData = AccountLayout.decode(tokenAccounts.value[0].account.data);
        const actualBalance = ataData.amount;
        console.log(`  Actual balance : ${actualBalance.toString()} raw units`);
        if (actualBalance === BigInt(0)) {
            throw new Error(`Agent has no ${mint.toBase58().slice(0, 8)}... tokens to sell`);
        }
        const requestedAmount = BigInt(tokenAmount.toString());
        if (requestedAmount > actualBalance) {
            console.log(`  ⚠️  Requested ${requestedAmount} > balance ${actualBalance}, capping to actual balance`);
            tokenAmount = new BN(actualBalance.toString());
        }

        // Log all fee recipients so we can identify the correct one
        console.log(`  global.feeRecipient     : ${global.feeRecipient.toBase58()}`);
        global.feeRecipients?.forEach((r: PublicKey, i: number) => {
            console.log(`  global.feeRecipients[${i}] : ${r.toBase58()}`);
        });

        const solAmount = getSellSolAmountFromTokenAmount({
            global,
            feeConfig,
            mintSupply: bondingCurve.tokenTotalSupply,
            bondingCurve,
            amount: tokenAmount,
        });

        console.log(`  Token program  : ${tokenProgram.toBase58()}`);
        console.log(`  Token amount   : ${tokenAmount.toString()}`);
        console.log(`  Sol amount out : ${solAmount.toString()}`);
        console.log(`  BC complete    : ${bondingCurve.complete}`);
        console.log(`  BC cashback    : ${(bondingCurve as any).cashbackEnabled ?? false}`);


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
    let txId: string;
    try {
        txId = await sendAndConfirmTransaction(connection, tx, [agentKeypair], {
            commitment: "confirmed",
            skipPreflight: true,
        });
    } catch (err: any) {
        if (typeof err?.getLogs === "function") {
            const logs: string[] = await err.getLogs(connection);
            console.error(`   TX logs:\n${logs.join("\n")}`);
        }
        throw err;
    }

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
- tokenAmount MUST be in raw units (multiply human amount by 10^decimals). PumpFun tokens have 6 decimals. Example: 39949.13326 tokens = 39949133260 raw units. NEVER drop digits — raw units are always larger than the human amount.
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