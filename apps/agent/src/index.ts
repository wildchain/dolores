import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";


import { startPolling, PendingTask } from "./poll";
import { executeTask, AgentDecision } from "./execute";
import { executeJupiterTask, JupiterDecision } from "./jupiter/execute-jupiter";
import { buildJupiterReceipt, signJupiterReceipt, executeJupiterSwap, completeJupiterTaskOnChain } from "./jupiter/submit-jupiter";
import { buildReceipt, signReceipt } from "./receipt";
import { executeSolTransfer, completeTaskOnChain, submitToIndexer } from "./submit";
import idlAdjudication from "../../../apps/cli/src/idl/dolores_adjudication.json";

// Config 

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const INDEXER_URL = process.env.INDEXER_URL || "http://localhost:3001";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "3000");
const AGENT_ID = process.env.AGENT_ID;
const TEMPLATE = process.env.AGENT_TEMPLATE || "SOL_TRANSFER";

if (!AGENT_ID) {
  console.error("❌ AGENT_ID env var required");
  process.exit(1);
}

// Load keypair 

function loadAgentKeypair(agentId: string): Keypair {
  const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ Agent keypair not found at ${keyPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// Process SOL_TRANSFER task 

async function processSolTransferTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: SOL_TRANSFER)...`);
  let decision: AgentDecision;
  try {
    decision = await executeTask(task.instruction, "SOL_TRANSFER");
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }

  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    await fetch(`${INDEXER_URL}/tasks/${task.taskId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    }).catch(() => { });
    return;
  }

  console.log(`\n⚡ Executing SOL transfer...`);
  console.log(`   To     : ${decision.recipient}`);
  console.log(`   Amount : ${decision.amountSol} SOL`);

  let txSignature: string;
  try {
    txSignature = await executeSolTransfer(
      connection, agentKeypair, decision.recipient, decision.amountLamports
    );
  } catch (err: any) {
    console.error(`   ❌ Transfer failed: ${err?.message}`);
    return;
  }

  console.log(`   ✅ TX: ${txSignature}`);

  const timestamp = Math.floor(Date.now() / 1000);
  const receipt = buildReceipt({
    taskId: task.taskId, agentId: agentKeypair.publicKey.toBase58(),
    instruction: task.instruction, action: decision, txSignature, timestamp,
  });
  const signed = signReceipt(receipt, agentKeypair);

  console.log(`\n📝 output_hash: ${signed.outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, signed.outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    try {
      await fetch(`${INDEXER_URL}/tasks/${task.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
    } catch { }
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    const { attestationTx, cid } = await submitToIndexer(
      INDEXER_URL, task.taskId, signed, timestamp, txSignature
    );
    console.log(`   ✅ CID: ${cid}`);
    console.log(`   ✅ Attestation: ${attestationTx ?? "pending"}`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Task complete: ${task.taskId.slice(0, 16)}...\n`);
}

//Process JUPITER_TRADER task

async function processJupiterTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  if (!process.env.JUPITER_API_KEY) {
    console.error(`   ❌ JUPITER_API_KEY not set in .env`);
    return;
  }

  console.log(`\n🤖 Asking Claude (template: JUPITER_TRADER)...`);
  let decision: JupiterDecision;
  try {
    decision = await executeJupiterTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }

  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    return;
  }

  if (decision.action === "wait") {
    console.log(`   ⏳ ${decision.reason}`);
    console.log(`   Current: $${decision.currentPrice} | Target: $${decision.targetPrice}`);
    return;
  }

  console.log(`\n⚡ Executing Jupiter swap...`);
  console.log(`   ${decision.amountSol} ${decision.inputSymbol} → ${decision.outputSymbol}`);
  console.log(`   Slippage: ${decision.slippageBps} bps`);

  let swapResult: { txSignature: string; inputAmount: string; outputAmount: string };
  try {
    swapResult = await executeJupiterSwap(agentKeypair, decision);
  } catch (err: any) {
    console.error(`   ❌ Swap failed: ${err?.message}`);
    return;
  }

  console.log(`   ✅ TX: ${swapResult.txSignature}`);
  console.log(`   In : ${swapResult.inputAmount} ${decision.inputSymbol}`);
  console.log(`   Out: ${swapResult.outputAmount} ${decision.outputSymbol}`);

  const timestamp = Math.floor(Date.now() / 1000);
  const receipt = buildJupiterReceipt({
    taskId: task.taskId,
    agentId: agentKeypair.publicKey.toBase58(),
    instruction: task.instruction,
    action: decision,
    txSignature: swapResult.txSignature,
    inputAmount: swapResult.inputAmount,
    outputAmount: swapResult.outputAmount,
    timestamp,
  });
  const { outputHash, agentSignature } = signJupiterReceipt(receipt, agentKeypair);

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeJupiterTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    const res = await fetch(`${INDEXER_URL}/tasks/${task.taskId}/complete`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputHash, completedAt: timestamp }),
    });

    await fetch(`${INDEXER_URL}/receipts/upload`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agentKeypair.publicKey.toBase58(),
        taskId: task.taskId, outputHash, timestamp, agentSignature,
      }),
    });

    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Jupiter task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// Main

async function main() {
  console.log("\n🤖 Dolores Agent Runtime\n");
  console.log(`Agent ID     : ${AGENT_ID}`);
  console.log(`Template     : ${TEMPLATE}`);
  console.log(`RPC          : ${RPC_URL}`);
  console.log(`Indexer      : ${INDEXER_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms\n`);

  const agentKeypair = loadAgentKeypair(AGENT_ID!);
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(agentKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const adjProgram = new Program(idlAdjudication as any, provider);

  const balance = await connection.getBalance(agentKeypair.publicKey);
  console.log(`Balance      : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 10_000_000) {
    console.warn(`⚠️  Low balance — fund at https://faucet.solana.com`);
  }

  console.log(`\n👂 Listening for tasks...`);

  const stop = startPolling(
    INDEXER_URL, AGENT_ID!, POLL_INTERVAL,
    async (tasks) => {
      console.log(`\n📬 ${tasks.length} pending task(s)`);
      for (const task of tasks) {
        console.log(`\n📋 Task: ${task.taskId.slice(0, 16)}...`);
        console.log(`   Instruction : ${task.instruction}`);
        console.log(`   Deadline    : ${new Date(task.deadline * 1000).toISOString()}`);

        if (TEMPLATE === "JUPITER_TRADER") {
          await processJupiterTask(task, agentKeypair, connection, adjProgram);
        } else {
          await processSolTransferTask(task, agentKeypair, connection, adjProgram);
        }
      }
    }
  );

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