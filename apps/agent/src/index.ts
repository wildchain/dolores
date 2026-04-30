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
import { parsePythCommand, executePythDecision, PythExecutionResult } from "./pyth/execute-pyth";
import { executeKaminoTask, executeKaminoAction, KaminoDecision, KaminoActionDecision, KaminoExecutionResult } from "./kamino/execute-kamino";
import { executeMeteoraTask, executeMeteoraAction, MeteoraDecision, MeteoraExecutionResult } from "./meteora/execute-meteora";
import { executeRaydiumTask, executeRaydiumAction, RaydiumDecision, RaydiumExecutionResult } from "./raydium/execute-raydium";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { executePumpFunTask, executePumpFunAction, PumpDecision, PumpExecutionResult } from "./pumpfun/execute-pumpfun";



const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const INDEXER_URL = process.env.INDEXER_URL || "http://localhost:3001";
const RECEIPT_URL = process.env.RECEIPT_URL || "http://localhost:8080";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "3000");
const AGENT_ID = process.env.AGENT_ID;
const TEMPLATE = process.env.AGENT_TEMPLATE || "SOL_TRANSFER";

if (!AGENT_ID) {
  console.error("❌ AGENT_ID env var required");
  process.exit(1);
}


function loadAgentKeypair(agentId: string): Keypair {
  const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ Agent keypair not found at ${keyPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

/** Mark a task completed in the API cache — prevents retry loops */
async function markTaskCompleted(taskId: string): Promise<void> {
  try {
    await fetch(`${INDEXER_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
  } catch { /* best-effort */ }
}

/** Upload a signed receipt to the indexer */
async function uploadReceipt(params: {
  agentId: string;
  taskId: string;
  outputHash: string;
  timestamp: number;
  agentSignature: string;
}): Promise<void> {
  const res = await fetch(`${RECEIPT_URL}/receipts/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Receipt upload failed ${res.status}: ${text}`);
  }
}

// SOL_TRANSFER 

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
    await markTaskCompleted(task.taskId);
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

// JUPITER_TRADER 

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
  console.log(`   Using mainnet RPC: ${process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com"}`);

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
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Jupiter task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// PYTH_ORACLE_READER 

async function processPythTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: PYTH_ORACLE_READER)...`);

  let result: PythExecutionResult;
  try {
    const decision = await parsePythCommand(task.instruction);
    console.log(`   Decision    : ${JSON.stringify(decision)}`);
    if (decision.action === "reject") {
      console.warn(`   ⚠️  Rejected: ${decision.reason}`);
      return;
    }
    result = await executePythDecision(decision);
  } catch (err: any) {
    console.error(`   ❌ Pyth failed: ${err?.message}`);
    return;
  }

  // Print price results
  if (result.action === "price" && result.prices) {
    for (const p of result.prices) {
      console.log(`   📊 ${p.symbol}: $${p.price.toFixed(4)} (conf: ±${p.confidence?.toFixed(4)})`);
    }
  } else if (result.action === "list" && result.supportedSymbols) {
    console.log(`   📋 Supported: ${result.supportedSymbols.join(", ")}`);
  }

  const timestamp = result.timestamp ?? Math.floor(Date.now() / 1000);
  const outputHash = require("crypto")
    .createHash("sha256")
    .update(JSON.stringify(result))
    .digest("hex");
  const { sign } = require("tweetnacl");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Pyth task complete: ${task.taskId.slice(0, 16)}...\n`);
}


// Generic DeFi Decision Handler 
// Used for templates that parse decisions but don't execute on-chain yet
// (KAMINO_LENDING, METEORA_POOLS, RAYDIUM_LP, PUMPFUN)

async function processDefiDecisionTask(
  template: string,
  executeTask: (instruction: string) => Promise<any>,
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: ${template})...`);

  let decision: any;
  try {
    decision = await executeTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }
  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    return;
  }

  console.log(`\n⚡ Decision parsed — execution not yet implemented for ${template}`);
  console.log(`   Action: ${decision.action}`);

  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require("crypto");
  const nacl = require("tweetnacl");
  const outputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ decision, timestamp }))
    .digest("hex");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ ${template} task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// KAMINO_LENDING

async function processKaminoTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: KAMINO_LENDING)...`);

  let decision: KaminoDecision;
  try {
    decision = await executeKaminoTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }
  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${(decision as any).reason}`);
    return;
  }
  if (decision.action === "status") {
    console.log(`   ℹ️  Status check — no execution needed`);
    return;
  }

  const kaminoDecision = decision as KaminoActionDecision;
  console.log(`\n⚡ Executing Kamino ${kaminoDecision.action}...`);
  console.log(`   Token  : ${kaminoDecision.token}`);
  console.log(`   Amount : ${kaminoDecision.amount}`);

  let result: KaminoExecutionResult;
  try {
    result = await executeKaminoAction(agentKeypair, kaminoDecision);
    console.log(`   ✅ TX: ${result.txSignature}`);
  } catch (err: any) {
    console.error(`   ❌ Kamino execution failed: ${err?.message}`);
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require("crypto");
  const nacl = require("tweetnacl");
  const outputHash = crypto.createHash("sha256")
    .update(JSON.stringify({ result, timestamp }))
    .digest("hex");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Kamino task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// METEORA_POOLS 

async function processMeteoraTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: METEORA_POOLS)...`);

  let decision: MeteoraDecision;
  try {
    decision = await executeMeteoraTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }
  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    return;
  }
  if (decision.action === "status") {
    console.log(`   ℹ️  Status check`);
    return;
  }

  console.log(`\n⚡ Executing Meteora ${decision.action}...`);

  let result: MeteoraExecutionResult;
  try {
    result = await executeMeteoraAction(agentKeypair, decision);
    console.log(`   ✅ TX: ${result.txSignature}`);
  } catch (err: any) {
    console.error(`   ❌ Meteora execution failed: ${err?.message}`);
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require("crypto");
  const nacl = require("tweetnacl");
  const outputHash = crypto.createHash("sha256")
    .update(JSON.stringify({ result, timestamp }))
    .digest("hex");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Meteora task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// RAYDIUM_LP 

async function processRaydiumTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: RAYDIUM_LP)...`);

  let decision: RaydiumDecision;
  try {
    decision = await executeRaydiumTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }
  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    return;
  }
  if (decision.action === "status") {
    console.log(`   ℹ️  Status check`);
    return;
  }

  console.log(`\n⚡ Executing Raydium ${decision.action}...`);

  let result: RaydiumExecutionResult;
  try {
    result = await executeRaydiumAction(agentKeypair, decision);
    console.log(`   ✅ TX: ${result.txSignature}`);
  } catch (err: any) {
    console.error(`   ❌ Full error:`, err);
    if (err?.message?.includes('429') ||
      err?.message?.includes('not found') ||
      err?.message?.includes('block height') ||
      !err?.message) {
      console.warn(`   ⚠️  Raydium failed — skipping: ${err?.message}`);
      await markTaskCompleted(task.taskId);
      return;
    }
    console.error(`   ❌ Raydium execution failed: ${err?.message}`);
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require("crypto");
  const nacl = require("tweetnacl");
  const outputHash = crypto.createHash("sha256")
    .update(JSON.stringify({ result, timestamp }))
    .digest("hex");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ Raydium task complete: ${task.taskId.slice(0, 16)}...\n`);
}

// PUMPFUN_TRADER

async function processPumpFunTask(
  task: PendingTask,
  agentKeypair: Keypair,
  connection: Connection,
  adjProgram: Program
): Promise<void> {
  console.log(`\n🤖 Asking Claude (template: PUMPFUN_TRADER)...`);

  let decision: PumpDecision;
  try {
    decision = await executePumpFunTask(task.instruction);
  } catch (err: any) {
    console.error(`   ❌ Claude failed: ${err?.message}`);
    return;
  }
  console.log(`   Decision    : ${JSON.stringify(decision)}`);

  if (decision.action === "reject") {
    console.warn(`   ⚠️  Rejected: ${decision.reason}`);
    return;
  }
  if (decision.action === "status") {
    console.log(`   ℹ️  Status check`);
    return;
  }

  console.log(`\n⚡ Executing PumpFun ${decision.action}...`);
  console.log(`   Mint   : ${decision.mint}`);
  console.log(`   Amount : ${decision.action === "buy" ? `${decision.solAmount} SOL` : `${decision.tokenAmount} tokens`}`);

  let result: PumpExecutionResult;
  try {
    result = await executePumpFunAction(agentKeypair, decision);
    console.log(`   ✅ TX: ${result.txSignature}`);
  } catch (err: any) {
    console.error(`   ❌ PumpFun execution failed: ${err?.message}`);
    await markTaskCompleted(task.taskId);
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require("crypto");
  const nacl = require("tweetnacl");
  const outputHash = crypto.createHash("sha256")
    .update(JSON.stringify({ result, timestamp }))
    .digest("hex");
  const outputHashBytes = Buffer.from(outputHash, "hex");
  const agentSignature = Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  ).toString("hex");

  console.log(`\n📝 output_hash: ${outputHash}`);
  console.log(`🔗 Writing on-chain...`);

  const taskIdBuffer = Buffer.from(task.taskId, "hex");
  try {
    const completeTx = await completeTaskOnChain(
      connection, agentKeypair, adjProgram, taskIdBuffer, outputHash
    );
    console.log(`   ✅ complete_task TX: ${completeTx}`);
    await markTaskCompleted(task.taskId);
  } catch (err: any) {
    console.error(`   ❌ complete_task failed: ${err?.message}`);
    return;
  }

  console.log(`\n📡 Submitting to indexer...`);
  try {
    await uploadReceipt({
      agentId: agentKeypair.publicKey.toBase58(),
      taskId: task.taskId,
      outputHash,
      timestamp,
      agentSignature,
    });
    console.log(`   ✅ Receipt submitted`);
  } catch (err: any) {
    console.error(`   ❌ Indexer failed: ${err?.message}`);
  }

  console.log(`\n✅ PumpFun task complete: ${task.taskId.slice(0, 16)}...\n`);
}


// Main 

async function main() {
  console.log("\n🤖 Dolores Agent Runtime\n");
  console.log(`Agent ID     : ${AGENT_ID}`);
  console.log(`Template     : ${TEMPLATE}`);
  console.log(`RPC          : ${RPC_URL}`);
  console.log(`Indexer      : ${INDEXER_URL}`);
  console.log(`Receipt URL  : ${RECEIPT_URL}`);
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
        switch (TEMPLATE) {
          case "JUPITER_TRADER":
            await processJupiterTask(task, agentKeypair, connection, adjProgram);
            break;
          case "PYTH_ORACLE_READER":
            await processPythTask(task, agentKeypair, connection, adjProgram);
            break;
          case "KAMINO_LENDING":
            await processKaminoTask(task, agentKeypair, connection, adjProgram);
            break;
          case "METEORA_POOLS":
            await processMeteoraTask(task, agentKeypair, connection, adjProgram);
            break;
          case "RAYDIUM_LP":
            await processRaydiumTask(task, agentKeypair, connection, adjProgram);
            break;
          case "PUMPFUN_TRADER":
            await processPumpFunTask(task, agentKeypair, connection, adjProgram);
            break;
          default:
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