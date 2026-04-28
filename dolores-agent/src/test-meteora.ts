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
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import DLMM from "@meteora-ag/dlmm";
import { executeMeteoraTask, DEFAULT_POOL, VERIFIED_TOKENS } from "./meteora/execute-meteora";

// ─── Config ───────────────────────────────────────────────────────────────────

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID = process.env.AGENT_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const METEORA_DLMM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

if (!AGENT_ID) { console.error("❌ AGENT_ID required"); process.exit(1); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(agentId: string): Keypair {
    const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
    if (!fs.existsSync(keyPath)) { console.error(`❌ No keypair at ${keyPath}`); process.exit(1); }
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8")))
    );
}

function buildReceipt(params: {
    agentId: string; instruction: string; operation: string;
    txSignatures: string[]; keypair: Keypair;
}) {
    const receipt = {
        schema_version: "1.0",
        task_id: `meteora-${Math.floor(Date.now() / 1000)}`,
        agent_id: params.agentId,
        instruction: params.instruction,
        timestamp_unix: Math.floor(Date.now() / 1000),
        execution: {
            tx_signatures: params.txSignatures,
            programs_called: [METEORA_DLMM],
            instructions_executed: [params.operation],
        },
        result: { status: "success", summary: `Meteora DLMM ${params.operation}` },
    };
    const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
    const outputHashBytes = crypto.createHash("sha256").update(canonical).digest();
    const outputHash = outputHashBytes.toString("hex");
    const sig = nacl.sign.detached(outputHashBytes, params.keypair.secretKey);
    return { receipt, outputHash, agentSignature: Buffer.from(sig).toString("hex") };
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function showStatus(connection: Connection, wallet: PublicKey, poolAddress: string) {
    console.log("\n💼 Fetching Meteora DLMM position...\n");

    const dlmm = await DLMM.create(connection, new PublicKey(poolAddress));
    const { activeBin, userPositions } = await dlmm.getPositionsByUserAndLbPair(wallet);

    console.log(`Pool      : ${poolAddress.slice(0, 8)}...`);
    console.log(`Active bin: ${activeBin.binId}`);
    console.log(`Price     : ${activeBin.price} USDC/SOL`);

    if (userPositions.length === 0) {
        console.log("\nNo active position — add liquidity first.");
        return;
    }

    const pos = userPositions[0];
    console.log(`\n=== Your Position ===`);
    console.log(`Address  : ${pos.publicKey.toString().slice(0, 8)}...`);
    console.log(`Bins     : ${pos.positionData.positionBinData.length}`);

    const totalX = pos.positionData.totalXAmount;
    const totalY = pos.positionData.totalYAmount;
    console.log(`SOL      : ${(Number(totalX) / 1e9).toFixed(6)}`);
    console.log(`USDC     : ${(Number(totalY) / 1e6).toFixed(6)}`);
    console.log(`Fee SOL  : ${(Number(pos.positionData.feeX) / 1e9).toFixed(6)}`);
    console.log(`Fee USDC : ${(Number(pos.positionData.feeY) / 1e6).toFixed(6)}`);
}

// ─── Add liquidity ────────────────────────────────────────────────────────────

async function addLiquidity(
    connection: Connection,
    agentKeypair: Keypair,
    poolAddress: string,
    amountX: number,
    amountY: number,
    binRange: number
): Promise<string[]> {
    const dlmm = await DLMM.create(connection, new PublicKey(poolAddress));
    const { activeBin } = await dlmm.getPositionsByUserAndLbPair(agentKeypair.publicKey);

    console.log(`Active bin: ${activeBin.binId}, Price: ${activeBin.price}`);

    const positionKeypair = Keypair.generate();
    console.log(`New position: ${positionKeypair.publicKey.toString()}`);

    const totalXAmount = new BN(Math.floor(amountX * 1e9));
    const totalYAmount = new BN(Math.floor(amountY * 1e6));

    const tx = await dlmm.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: positionKeypair.publicKey,
        user: agentKeypair.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
            maxBinId: activeBin.binId + binRange,
            minBinId: activeBin.binId - binRange,
            strategyType: 0 as any, // StrategyType.SpotBalanced = 0
        },
    });

    const txHash = await sendAndConfirmTransaction(
        connection, tx, [agentKeypair, positionKeypair],
        { commitment: "confirmed" }
    );
    return [txHash];
}

// ─── Remove liquidity ─────────────────────────────────────────────────────────

async function removeLiquidity(
    connection: Connection,
    agentKeypair: Keypair,
    poolAddress: string,
    bps: number
): Promise<string[]> {
    const dlmm = await DLMM.create(connection, new PublicKey(poolAddress));
    const { userPositions } = await dlmm.getPositionsByUserAndLbPair(agentKeypair.publicKey);

    if (userPositions.length === 0) throw new Error("No position found");

    const pos = userPositions[0];
    const bins = pos.positionData.positionBinData;
    const fromBinId = Math.min(...bins.map((b: any) => b.binId));
    const toBinId = Math.max(...bins.map((b: any) => b.binId));

    const txs = await dlmm.removeLiquidity({
        position: pos.publicKey,
        user: agentKeypair.publicKey,
        fromBinId,
        toBinId,
        bps: new BN(bps),
        shouldClaimAndClose: bps === 10000,
    });

    // may return single tx or array
    const txList = Array.isArray(txs) ? txs : [txs];
    const hashes: string[] = [];
    for (const tx of txList) {
        const hash = await sendAndConfirmTransaction(
            connection, tx, [agentKeypair],
            { commitment: "confirmed" }
        );
        hashes.push(hash);
    }
    return hashes;
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

async function swapTokens(
    connection: Connection,
    agentKeypair: Keypair,
    poolAddress: string,
    tokenIn: string,
    amountIn: number
): Promise<string> {
    const dlmm = await DLMM.create(connection, new PublicKey(poolAddress));
    await dlmm.refetchStates();

    const tokenInfo = VERIFIED_TOKENS[tokenIn];
    if (!tokenInfo) throw new Error(`Unknown token: ${tokenIn}`);

    const inAmount = new BN(Math.floor(amountIn * Math.pow(10, tokenInfo.decimals)));
    const swapForY = tokenIn === "SOL";
    const binArrays = await dlmm.getBinArrayForSwap(swapForY);
    const quote = await dlmm.swapQuote(inAmount, swapForY, new BN(100), binArrays);

    console.log(`Quote: ${amountIn} ${tokenIn} → out: ${quote.outAmount.toString()}`);

    const outToken = swapForY ? VERIFIED_TOKENS["USDC"] : VERIFIED_TOKENS["SOL"];

    const tx = await dlmm.swap({
        inToken: new PublicKey(tokenInfo.mint),
        binArraysPubkey: binArrays.map((b: any) => b.publicKey),
        inAmount,
        lbPair: new PublicKey(poolAddress),
        user: agentKeypair.publicKey,
        minOutAmount: quote.minOutAmount,
        outToken: new PublicKey(outToken.mint),
    });

    return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
        commitment: "confirmed",
    });
}

// ─── Collect fees ─────────────────────────────────────────────────────────────
async function collectFees(
    connection: Connection,
    agentKeypair: Keypair,
    poolAddress: string
): Promise<string[]> {
    const dlmm = await DLMM.create(connection, new PublicKey(poolAddress));
    const { userPositions } = await dlmm.getPositionsByUserAndLbPair(agentKeypair.publicKey);

    if (userPositions.length === 0) throw new Error("No position found");

    const pos = userPositions[0];
    console.log(`Fee SOL  : ${(Number(pos.positionData.feeX) / 1e9).toFixed(6)}`);
    console.log(`Fee USDC : ${(Number(pos.positionData.feeY) / 1e6).toFixed(6)}`);

    const txs = await dlmm.claimSwapFee({
        owner: agentKeypair.publicKey,
        position: pos,          // ← full LbPosition object, not pos.publicKey
    });

    const txList = Array.isArray(txs) ? txs : [txs];
    const hashes: string[] = [];
    for (const tx of txList) {
        const hash = await sendAndConfirmTransaction(connection, tx, [agentKeypair], {
            commitment: "confirmed",
        });
        hashes.push(hash);
    }
    return hashes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const instruction = args.join(" ") || "help";

    console.log("\n🌊 Dolores Meteora DLMM Agent\n");
    console.log(`Agent    : ${AGENT_ID}`);
    console.log(`Command  : ${instruction}\n`);

    const agentKeypair = loadKeypair(AGENT_ID);
    const connection = new Connection(RPC_URL, "confirmed");

    if (instruction === "help") {
        console.log("Commands:");
        console.log("  status                              — show position + active bin");
        console.log("  'add liquidity 0.01 SOL 1.5 USDC'  — add liquidity to SOL/USDC pool");
        console.log("  'remove all liquidity'              — remove 100% and close position");
        console.log("  'remove 50% liquidity'              — remove 50% of position");
        console.log("  'swap 0.001 SOL to USDC'            — swap via DLMM");
        console.log("  'collect fees'                      — claim accumulated swap fees");
        return;
    }

    if (instruction === "status") {
        await showStatus(connection, agentKeypair.publicKey, DEFAULT_POOL);
        return;
    }

    console.log("🤖 Asking Claude...");
    const decision = await executeMeteoraTask(instruction);
    console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

    if (decision.action === "reject") {
        console.log(`⚠️  Rejected: ${decision.reason}`);
        return;
    }

    if (decision.action === "status") {
        await showStatus(connection, agentKeypair.publicKey, decision.poolAddress ?? DEFAULT_POOL);
        return;
    }

    const poolAddress = decision.poolAddress ?? DEFAULT_POOL;
    let txSignatures: string[] = [];

    try {
        switch (decision.action) {
            case "add_liquidity":
                console.log(`⚡ Adding liquidity: ${decision.amountX} SOL + ${decision.amountY} USDC`);
                txSignatures = await addLiquidity(
                    connection, agentKeypair, poolAddress,
                    decision.amountX ?? 0.01, decision.amountY ?? 1.5, decision.binRange ?? 10
                );
                break;

            case "remove_liquidity":
                console.log(`⚡ Removing ${(decision.bps ?? 10000) / 100}% liquidity`);
                txSignatures = await removeLiquidity(
                    connection, agentKeypair, poolAddress, decision.bps ?? 10000
                );
                break;

            case "swap":
                console.log(`⚡ Swapping ${decision.amountX} ${decision.tokenX} → ${decision.tokenY}`);
                txSignatures = [await swapTokens(
                    connection, agentKeypair, poolAddress,
                    decision.tokenX ?? "SOL", decision.amountX ?? 0.001
                )];
                break;

            case "collect_fees":
                console.log(`⚡ Collecting swap fees`);
                txSignatures = await collectFees(connection, agentKeypair, poolAddress);
                break;
        }
    } catch (err: any) {
        console.error(`❌ Transaction failed: ${err?.message}`);
        return;
    }

    txSignatures.forEach((sig, i) => {
        console.log(`\n✅ ${decision.action} confirmed! (tx ${i + 1}/${txSignatures.length})`);
        console.log(`TX       : ${sig}`);
        console.log(`Explorer : https://solscan.io/tx/${sig}`);
    });

    const { outputHash, agentSignature } = buildReceipt({
        agentId: agentKeypair.publicKey.toBase58(),
        instruction,
        operation: decision.action,
        txSignatures,
        keypair: agentKeypair,
    });

    console.log(`\n📝 Output hash : ${outputHash}`);
    console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
    console.log(`\n✅ Full loop complete!`);
    console.log(`   Claude parsed instruction       ✓`);
    console.log(`   Meteora ${decision.action} executed    ✓`);
    console.log(`   output_hash signed by agent     ✓`);

    await showStatus(connection, agentKeypair.publicKey, poolAddress);
}

main().catch(err => {
    console.error("\n❌ Fatal:", err?.message ?? err);
    process.exit(1);
});