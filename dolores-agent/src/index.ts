import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idlAdjudication from "../idl/dolores_adjudication.json";

import { startPolling, PendingTask } from "./poll";
import { executeTask, AgentDecision } from "./execute";
import { buildReceipt, signReceipt } from "./receipt";
import { executeSolTransfer, completeTaskOnChain, submitToIndexer } from "./submit";
import "dotenv/config";

//  Config 

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const INDEXER_URL = process.env.INDEXER_URL || "http://localhost:8080";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "3000");
const AGENT_ID = process.env.AGENT_ID;
const TEMPLATE = process.env.AGENT_TEMPLATE || "SOL_TRANSFER";

if (!AGENT_ID) {
    console.error("❌ AGENT_ID env var required — set to your agent pubkey");
    process.exit(1);
}

//  Load agent keypair 

function loadAgentKeypair(agentId: string): Keypair {
    const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
    if (!fs.existsSync(keyPath)) {
        console.error(`❌ Agent keypair not found at ${keyPath}`);
        console.error(`   Run: dolores register`);
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

//  Process a single task 

async function processTask(
    task: PendingTask,
    agentKeypair: Keypair,
    connection: Connection,
    adjProgram: Program
): Promise<void> {
    console.log(`\n📋 Task: ${task.taskId.slice(0, 16)}...`);
    console.log(`   Instruction : ${task.instruction}`);
    console.log(`   Deadline    : ${new Date(task.deadline * 1000).toISOString()}`);

    //  Step 1: Ask Claude what to do 
    console.log(`\n🤖 Asking Claude (template: ${TEMPLATE})...`);
    let decision: AgentDecision;
    try {
        decision = await executeTask(task.instruction, TEMPLATE);
    } catch (err: any) {
        console.error(`   ❌ Claude failed: ${err?.message}`);
        return;
    }

    console.log(`   Decision    : ${JSON.stringify(decision)}`);

    //  Step 2: Reject if out of scope 
    if (decision.action === "reject") {
        console.warn(`   ⚠️  Task rejected: ${decision.reason}`);
        console.warn(`   Marking task failed in indexer...`);

        await fetch(`${INDEXER_URL}/tasks/${task.taskId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dismissed" }),
        }).catch(() => { });

        return;
    }

    //  Step 3: Execute SOL transfer 
    console.log(`\n⚡ Executing transfer...`);
    console.log(`   To          : ${decision.recipient}`);
    console.log(`   Amount      : ${decision.amountSol} SOL`);

    let txSignature: string;
    try {
        txSignature = await executeSolTransfer(
            connection,
            agentKeypair,
            decision.recipient,
            decision.amountLamports
        );
    } catch (err: any) {
        console.error(`   ❌ Transfer failed: ${err?.message}`);
        return;
    }

    console.log(`   ✅ Transfer confirmed`);
    console.log(`   TX          : ${txSignature}`);
    console.log(`   Explorer    : https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);

    const timestamp = Math.floor(Date.now() / 1000);

    const receipt = buildReceipt({
        taskId: task.taskId,
        agentId: agentKeypair.publicKey.toBase58(),
        instruction: task.instruction,
        action: decision,
        txSignature,
        timestamp,
    });

    const signed = signReceipt(receipt, agentKeypair);

    console.log(`\n📝 Receipt signed`);
    console.log(`   output_hash : ${signed.outputHash}`);

    console.log(`\n🔗 Writing output_hash on-chain...`);
    const taskIdBuffer = Buffer.from(task.taskId, "hex");

    let completeTaskTx: string;
    try {
        completeTaskTx = await completeTaskOnChain(
            connection,
            agentKeypair,
            adjProgram,
            taskIdBuffer,
            signed.outputHash
        );
    } catch (err: any) {
        console.error(`   ❌ complete_task() failed: ${err?.message}`);
        return;
    }

    console.log(`   ✅ complete_task confirmed`);
    console.log(`   TX          : ${completeTaskTx}`);

    console.log(`\n📡 Submitting receipt to indexer...`);
    try {
        const { attestationTx, cid } = await submitToIndexer(
            INDEXER_URL,
            task.taskId,
            signed,
            timestamp,
            completeTaskTx
        );

        console.log(`   ✅ Receipt submitted`);
        console.log(`   CID         : ${cid}`);
        console.log(`   Attestation : ${attestationTx ?? "pending"}`);
    } catch (err: any) {
        console.error(`   ❌ Indexer submission failed: ${err?.message}`);
        // Task is complete on-chain — indexer failure is non-fatal
        return;
    }

    console.log(`\n✅ Task complete: ${task.taskId.slice(0, 16)}...\n`);
}


async function main() {
    console.log("\n🤖 Dolores Agent Runtime\n");
    console.log(`Agent ID    : ${AGENT_ID}`);
    console.log(`Template    : ${TEMPLATE}`);
    console.log(`RPC         : ${RPC_URL}`);
    console.log(`Indexer     : ${INDEXER_URL}`);
    console.log(`Poll interval: ${POLL_INTERVAL}ms\n`);

    const agentKeypair = loadAgentKeypair(AGENT_ID!);
    const connection = new Connection(RPC_URL, "confirmed");
    const wallet = new Wallet(agentKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const adjProgram = new Program(idlAdjudication as any, provider);

    // Check balance
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log(`Balance     : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    if (balance < 10_000_000) {
        console.warn(`⚠️  Low balance — agent may not be able to execute transfers`);
        console.warn(`   Fund at https://faucet.solana.com`);
    }

    console.log(`\n👂 Listening for tasks...`);

    const stop = startPolling(
        INDEXER_URL,
        AGENT_ID!,
        POLL_INTERVAL,
        async (tasks) => {
            console.log(`\n📬 ${tasks.length} pending task(s)`);
            // Process one task at a time — sequential, predictable
            for (const task of tasks) {
                await processTask(task, agentKeypair, connection, adjProgram);
            }
        }
    );

    // Graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n\nStopping agent...");
        stop();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});