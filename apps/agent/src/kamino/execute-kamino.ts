import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { KaminoMarket, KaminoAction, VanillaObligation } from "@kamino-finance/klend-sdk";
import { DEFAULT_KLEND_PROGRAM_ID } from "@kamino-finance/klend-sdk/dist/utils/constants";


const client = new Anthropic();




export const KAMINO_TOKENS: Record<string, { mint: string; decimals: number }> = {
    SOL: {
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
    },
    USDC: {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        decimals: 6,
    },
    USDT: {
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe",
        decimals: 6,
    },
    MSOL: {
        mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
        decimals: 9,
    },
    JITOSOL: {
        mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
        decimals: 9,
    },
    BONK: {
        mint: "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd",
        decimals: 5,
    },
};


//Types 

export type KaminoOp = "deposit" | "withdraw" | "borrow" | "repay" | "status";

export interface KaminoActionDecision {
    action: KaminoOp;
    token: string;
    amount: number;
    amountBase: string;
    useMax?: boolean;
}



export interface KaminoStatus {
    action: "status";
}

export interface KaminoReject {
    action: "reject";
    reason: string;
}
export type KaminoDecision = KaminoActionDecision | KaminoStatus | KaminoReject;



// Load skill 

function loadSkill(): string {
    const skillFile = path.join(__dirname, "../../skills/kamino-lend.md");
    if (!fs.existsSync(skillFile)) {
        throw new Error(`Kamino skill not found at ${skillFile}`);
    }
    return fs.readFileSync(skillFile, "utf-8");
}

//  Main 

export async function executeKaminoTask(
    instruction: string
): Promise<KaminoDecision> {
    const skillContext = loadSkill();
    const tokenList = Object.keys(KAMINO_TOKENS).join(", ");

    const system = `You are a DeFi agent parser for Kamino lending operations.

Supported tokens: ${tokenList}

Parse the instruction and return ONLY a JSON object. No explanation. No markdown. Start with { end with }.

For deposit/withdraw/borrow/repay:
{"action":"deposit","token":"SOL","amount":0.05,"amountBase":"50000000"}

For max repay/withdraw:
{"action":"repay","token":"USDC","amount":0,"amountBase":"max","useMax":true}

For position check:
{"action":"status"}

For out-of-scope (swaps, transfers to other wallets, anything not lending):
{"action":"reject","reason":"one sentence"}

Rules:
- Only reject if the operation is genuinely out of scope (not a lending operation)
- Do NOT reject based on amount size — let the protocol enforce minimums
- Supported operations: deposit, withdraw, borrow, repay only`;

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

    let parsed: any;
    try {
        parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
        throw new Error(`Parse failed: ${raw}`);
    }

    if (parsed.action === "reject") return { action: "reject", reason: parsed.reason };
    if (parsed.action === "status") return { action: "status" };

    // Validate token
    const tokenKey = (parsed.token || "").toUpperCase();
    if (!KAMINO_TOKENS[tokenKey]) {
        return {
            action: "reject",
            reason: `Token ${parsed.token} not supported. Use: ${tokenList}`,
        };
    }

    // Handle max
    if (parsed.useMax) {
        return {
            action: parsed.action,
            token: tokenKey,
            amount: 0,
            amountBase: "max",
            useMax: true,
        };
    }

    // Calculate amountBase from amount
    const { decimals } = KAMINO_TOKENS[tokenKey];
    const amount = parseFloat(parsed.amount) || 0;
    const amountBase = Math.floor(amount * Math.pow(10, decimals)).toString();

    return {
        action: parsed.action,
        token: tokenKey,
        amount,
        amountBase,
    };
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface KaminoExecutionResult {
    action: string;
    txSignature?: string;
    token?: string;
    amount?: number;
    reason?: string;
}

export async function executeKaminoAction(
    agentKeypair: Keypair,
    decision: KaminoActionDecision,
): Promise<KaminoExecutionResult> {
    const connection = new Connection(
        process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
    );
    const KLEND_PROGRAM_ID = new PublicKey(DEFAULT_KLEND_PROGRAM_ID);
    const marketAddress = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
    const mintPubkey = new PublicKey(KAMINO_TOKENS[decision.token].mint);
    const owner = agentKeypair.publicKey;

    const market = await KaminoMarket.load(connection, marketAddress, 400, KLEND_PROGRAM_ID, false, true);
    if (!market) throw new Error("Failed to load Kamino market");

    const reserve = market.getReserveByMint(mintPubkey);
    if (!reserve) throw new Error(`No Kamino reserve found for ${decision.token}`);

    const amount = decision.useMax ? "18446744073709551615" : decision.amountBase;
    const obligationType = new VanillaObligation(KLEND_PROGRAM_ID);
    const currentSlot = await connection.getSlot();

    let kaminoTx: KaminoAction;



    switch (decision.action) {
        case "deposit":
            kaminoTx = await KaminoAction.buildDepositTxns(
                market, amount, mintPubkey, owner, obligationType,
                1_000_000, true
            );
            break;
        case "withdraw":
            kaminoTx = await KaminoAction.buildWithdrawTxns(
                market, amount, mintPubkey, owner, obligationType,
                1_000_000, true
            );
            break;
        case "borrow":
            kaminoTx = await KaminoAction.buildBorrowTxns(
                market, amount, mintPubkey, owner, obligationType,
                1_000_000, true
            );
            break;
        case "repay":
            kaminoTx = await KaminoAction.buildRepayTxns(
                market, amount, mintPubkey, owner, obligationType,
                currentSlot, undefined, 1_000_000, true
            );
            break;
        default:
            throw new Error(`Unknown Kamino action: ${decision.action}`);
    }

    const allIxs = [
        ...kaminoTx.setupIxs,
        ...kaminoTx.lendingIxs,
        ...kaminoTx.inBetweenIxs,
        ...kaminoTx.cleanupIxs,
    ];

    const tx = new Transaction().add(...allIxs);
    tx.feePayer = owner;
    const txSignature = await sendAndConfirmTransaction(
        connection, tx, [agentKeypair], { commitment: "confirmed" }
    );

    return { action: decision.action, txSignature, token: decision.token, amount: decision.amount };
}