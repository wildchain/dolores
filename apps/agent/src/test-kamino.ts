import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    VersionedTransaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import fetch from "node-fetch";
import { executeKaminoTask } from "./kamino/execute-kamino";

// ─── Config ───────────────────────────────────────────────────────────────────

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID = process.env.AGENT_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const KAMINO_API = "https://api.kamino.finance";
const KAMINO_LEND = "KLend2g3cP87ber41qQDzWpAFuqP2tCxDqC8S3k7L1U";
const MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

if (!AGENT_ID) { console.error("❌ AGENT_ID required"); process.exit(1); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(agentId: string): Keypair {
    const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
    if (!fs.existsSync(keyPath)) { console.error(`❌ No keypair at ${keyPath}`); process.exit(1); }
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8")))
    );
}

async function kaminoFetch<T>(endpoint: string, init?: any): Promise<T> {
    const res = await fetch(`${KAMINO_API}${endpoint}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Kamino API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

function buildReceipt(params: {
    agentId: string; instruction: string; operation: string;
    token: string; amount: string; txSignature: string; keypair: Keypair;
}) {
    const receipt = {
        schema_version: "1.0",
        task_id: `kamino-${Math.floor(Date.now() / 1000)}`,
        agent_id: params.agentId,
        instruction: params.instruction,
        timestamp_unix: Math.floor(Date.now() / 1000),
        execution: {
            tx_signatures: [params.txSignature],
            programs_called: [KAMINO_LEND],
            instructions_executed: [params.operation],
            token_transfers: [{ token: params.token, amount: params.amount, operation: params.operation }],
        },
        result: { status: "success", summary: `Kamino ${params.operation}: ${params.amount} ${params.token}` },
    };
    const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
    const outputHashBytes = crypto.createHash("sha256").update(canonical).digest();
    const outputHash = outputHashBytes.toString("hex");
    const sig = nacl.sign.detached(outputHashBytes, params.keypair.secretKey);
    return { receipt, outputHash, agentSignature: Buffer.from(sig).toString("hex") };
}

// ─── Kamino REST API operations ───────────────────────────────────────────────

async function getMarketInfo() {
    return kaminoFetch<any[]>("/v2/kamino-market");
}

async function getReserveMetrics() {
    return kaminoFetch<any>(`/kamino-market/${MAIN_MARKET}/reserves/metrics`);
}

async function getUserObligations(wallet: string) {
    return kaminoFetch<any>(`/kamino-market/${MAIN_MARKET}/users/${wallet}/obligations`);
}

async function getOraclePrices() {
    return kaminoFetch<any>("/oracles/prices");
}

// ─── KTX transaction builders ─────────────────────────────────────────────────

async function buildKaminoTx(
    operation: "deposit" | "withdraw" | "borrow" | "repay",
    wallet: string,
    tokenMint: string,
    amount: string
): Promise<string> {
    // First get the reserve address for this mint
    const reserves = await getReserveMetrics();
    const reserveList = Array.isArray(reserves) ? reserves : reserves?.reserves ?? [];
    const reserve = reserveList.find((r: any) => r.liquidityTokenMint === tokenMint);
    let finalAmount = amount;

    if (amount === "max") {
        const obligations = await kaminoFetch<any>(
            `/kamino-market/${MAIN_MARKET}/users/${wallet}/obligations`
        );
        const ob = Array.isArray(obligations) ? obligations[0] : obligations?.obligations?.[0];
        const borrow = ob?.state?.borrows?.find((b: any) =>
            b.borrowReserve === reserve.reserve
        );
        // borrowedAmountSf is scaled by 2^60, divide to get actual amount
        finalAmount = borrow ? "0.1" : "0.001"; // fallback
    }


    if (!reserve) throw new Error(`No reserve found for mint ${tokenMint}`);

    const body = {
        wallet,
        market: MAIN_MARKET,
        mint: tokenMint,
        reserve: reserve.reserve,
        amount: amount,   // human readable, not lamports
        obligationType: "VanillaObligation",
    };

    const result = await kaminoFetch<{ transaction: string; error?: string }>(
        `/ktx/klend/${operation}`,
        { method: "POST", body: JSON.stringify(body) }
    );

    if (result.error) throw new Error(`KTX ${operation} failed: ${result.error}`);
    return result.transaction;
}

async function signAndSendTx(
    connection: Connection,
    agentKeypair: Keypair,
    txBase64: string
): Promise<string> {
    const txBuffer = Buffer.from(txBase64, "base64");

    // Always use VersionedTransaction for Kamino
    const tx = VersionedTransaction.deserialize(txBuffer);
    tx.sign([agentKeypair]);

    const sig = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3,
    });

    await connection.confirmTransaction(sig, "confirmed");
    return sig;
}

// ─── Show position ────────────────────────────────────────────────────────────

async function showPosition(wallet: string) {
    console.log("\n💼 Fetching Kamino position...\n");

    try {
        // Get oracle prices
        const prices = await getOraclePrices();
        const solPrice = prices?.prices?.find((p: any) =>
            p.mint === "So11111111111111111111111111111111111111112"
        );
        if (solPrice) {
            console.log(`SOL price : $${parseFloat(solPrice.price).toFixed(2)}`);
        }

        // Get reserve metrics
        const reserves = await getReserveMetrics();
        console.log("\n=== Top Reserves ===");
        const reserveList = Array.isArray(reserves) ? reserves : reserves?.reserves ?? [];
        console.log("Reserve sample:", JSON.stringify(reserveList[0], null, 2));
        reserveList.slice(0, 6).forEach((r: any) => {
            const sym = r.liquidityToken ?? "?";
            const supply = r.supplyInterestAPY ?? r.supplyApy ?? 0;
            const borrow = r.borrowInterestAPY ?? r.borrowApy ?? 0;
            console.log(`  ${sym.padEnd(8)} | Supply ${(supply * 100).toFixed(2)}% | Borrow ${(borrow * 100).toFixed(2)}%`);
        });

        // Get user position
        const obligations = await getUserObligations(wallet);
        const obList = Array.isArray(obligations) ? obligations : obligations?.obligations ?? [];

        if (obList.length === 0) {
            console.log("\nNo active position — deposit first to create one.");
            return;
        }

        const ob = obList[0];
        const deposits = ob.state?.deposits?.filter((d: any) =>
            d.depositReserve !== "11111111111111111111111111111111"
        ) ?? [];
        const borrows = ob.state?.borrows?.filter((b: any) =>
            b.borrowReserve !== "11111111111111111111111111111111"
        ) ?? [];
        console.log("\n=== Your Position ===");
        console.log(`Deposits: ${deposits.length}`);
        deposits.forEach((d: any) =>
            console.log(`  Reserve: ${d.depositReserve.slice(0, 8)}... Amount: ${d.depositedAmount}`)
        );

        console.log(`Borrows: ${borrows.length}`);
        borrows.forEach((b: any) =>
            console.log(`  Reserve: ${b.borrowReserve.slice(0, 8)}... Amount: ${b.borrowedAmountSf}`)
        );

        console.log(`Deposited : $${parseFloat(ob.depositedValue ?? ob.totalDeposit ?? "0").toFixed(2)}`);
        console.log(`Borrowed  : $${parseFloat(ob.borrowedValue ?? ob.totalBorrow ?? "0").toFixed(2)}`);
        console.log(`Health    : ${ob.loanToValue ?? ob.healthFactor ?? "?"}`);


        if (ob.deposits?.length > 0) {
            console.log("\nDeposits:");
            ob.deposits.forEach((d: any) =>
                console.log(`  ${d.symbol ?? d.tokenSymbol}: $${parseFloat(d.marketValueRefreshed ?? d.value ?? "0").toFixed(2)}`)
            );
        }
        if (ob.borrows?.length > 0) {
            console.log("\nBorrows:");
            ob.borrows.forEach((b: any) =>
                console.log(`  ${b.symbol ?? b.tokenSymbol}: $${parseFloat(b.marketValueRefreshed ?? b.value ?? "0").toFixed(2)}`)
            );
        }
    } catch (err: any) {
        console.error("Position fetch failed:", err?.message);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const instruction = args.join(" ") || "help";

    console.log("\n🏦 Dolores Kamino Agent (REST API)\n");
    console.log(`Agent    : ${AGENT_ID}`);
    console.log(`Command  : ${instruction}\n`);

    const agentKeypair = loadKeypair(AGENT_ID);
    const connection = new Connection(RPC_URL, "confirmed");

    if (instruction === "help") {
        console.log("Commands:");
        console.log("  status                   — show position + reserves");
        console.log("  deposit 0.01 SOL         — deposit SOL as collateral");
        console.log("  withdraw 0.01 SOL        — withdraw SOL");
        console.log("  borrow 0.5 USDC          — borrow USDC against collateral");
        console.log("  repay 0.5 USDC           — repay USDC debt");
        console.log("  'repay max USDC'         — repay all USDC");
        return;
    }

    if (instruction === "status") {
        await showPosition(agentKeypair.publicKey.toBase58());
        return;
    }

    // ── AI-parsed operations ──────────────────────────────────────────────────
    console.log("🤖 Asking Claude...");
    const decision = await executeKaminoTask(instruction);
    console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

    if (decision.action === "reject") {
        console.log(`⚠️  Rejected: ${decision.reason}`);
        return;
    }

    if (decision.action === "status") {
        await showPosition(agentKeypair.publicKey.toBase58());
        return;
    }

    // Get token mint
    const { KAMINO_TOKENS } = await import("./kamino/execute-kamino");
    const tokenInfo = KAMINO_TOKENS[decision.token];
    if (!tokenInfo) {
        console.error(`❌ Unknown token: ${decision.token}`);
        return;
    }

    console.log(`⚡ Building Kamino ${decision.action} tx via KTX API...`);
    console.log(`   ${decision.useMax ? "MAX" : decision.amount} ${decision.token}`);

    let txBase64: string;
    try {
        txBase64 = await buildKaminoTx(
            decision.action as any,
            agentKeypair.publicKey.toBase58(),
            tokenInfo.mint,
            decision.amount.toString()
        );
    } catch (err: any) {
        console.error(`❌ KTX API failed: ${err?.message}`);
        return;
    }

    console.log(`   ✅ Transaction built — signing...`);

    let txSignature: string;
    try {
        txSignature = await signAndSendTx(connection, agentKeypair, txBase64);
    } catch (err: any) {
        console.error(`❌ Transaction failed: ${err?.message}`);
        return;
    }

    console.log(`\n✅ ${decision.action} confirmed!`);
    console.log(`TX       : ${txSignature}`);
    console.log(`Explorer : https://solscan.io/tx/${txSignature}`);

    const { outputHash, agentSignature } = buildReceipt({
        agentId: agentKeypair.publicKey.toBase58(),
        instruction,
        operation: decision.action,
        token: decision.token,
        amount: decision.amountBase,
        txSignature,
        keypair: agentKeypair,
    });

    console.log(`\n📝 Output hash : ${outputHash}`);
    console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
    console.log(`\n✅ Full loop complete!`);
    console.log(`   Claude parsed instruction       ✓`);
    console.log(`   Kamino ${decision.action} via REST API     ✓`);
    console.log(`   output_hash signed by agent     ✓`);

    await showPosition(agentKeypair.publicKey.toBase58());
}

main().catch(err => {
    console.error("\n❌ Fatal:", err?.message ?? err);
    process.exit(1);
});