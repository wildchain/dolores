import "dotenv/config";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { executeTask } from "./execute";
import { buildReceipt, signReceipt } from "./receipt";
import {
  executeSolTransfer,
  registerTask,
  submitToIndexer,
  submitAttestation,
} from "./submit";

// ─── Config ───────────────────────────────────────────────────────────────────

const AGENT_ID = process.env.AGENT_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const INDEXER_URL = "https://node.dolores.id";

if (!AGENT_ID) {
  console.error("❌ AGENT_ID env var required");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(agentId: string): Keypair {
  const keyPath = path.join(`agent-${agentId}.json`);
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ No keypair found at ${keyPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  console.log(`Loaded keypair : ${keypair.publicKey.toBase58()}`);
  return keypair;
}

/** Generates a random 32-byte task ID. Returns { hex, buffer }. */
function generateTaskId(): { hex: string; buffer: Buffer } {
  const buffer = crypto.randomBytes(32);
  return { hex: buffer.toString("hex"), buffer };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const instruction = args.join(" ") || "help";

  console.log("\n⚡ Dolores SOL Transfer Agent (devnet)\n");
  console.log(`Agent   : ${AGENT_ID}`);
  console.log(`Network : devnet (${RPC_URL})`);
  console.log(`Command : ${instruction}\n`);

  if (instruction === "help") {
    console.log("Commands:");
    console.log("  'transfer 0.001 SOL to <pubkey>'  — transfer SOL on devnet");
    console.log(
      "  'send 0.5 SOL to <pubkey>'        — same thing, different phrasing",
    );
    return;
  }

  const agentKeypair = loadKeypair(AGENT_ID);
  const connection = new Connection(RPC_URL, "confirmed");

  // ── Check balance ─────────────────────────────────────────────────────────
  const balance = await connection.getBalance(agentKeypair.publicKey);
  console.log(`Balance : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 5000) {
    console.log("\nInsufficient balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(
      agentKeypair.publicKey,
      LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig);
    console.log(`Airdrop tx : ${sig}`);
  }

  // ── Ask Claude ────────────────────────────────────────────────────────────
  console.log("\nAsking Claude...");
  const decision = await executeTask(instruction, "SOL_TRANSFER");
  console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

  if (decision.action === "reject") {
    console.log(`Rejected: ${decision.reason}`);
    return;
  }

  console.log(`Recipient : ${decision.recipient}`);
  console.log(`Amount    : ${decision.amountSol} SOL\n`);

  // ── Execute transfer ──────────────────────────────────────────────────────
  console.log("Executing SOL transfer...");
  let txSignature: string;
  try {
    txSignature = await executeSolTransfer(
      connection,
      agentKeypair,
      decision.recipient,
      decision.amountLamports,
    );
  } catch (err: any) {
    console.error(`❌ Transfer failed: ${err?.message}`);
    return;
  }

  console.log(`\nTransfer confirmed!`);
  console.log(`TX       : ${txSignature}`);
  console.log(`Explorer : https://solscan.io/tx/${txSignature}?cluster=devnet`);

  // ── Register task on-chain ────────────────────────────────────────────────
  const { hex: taskId, buffer: taskIdBuffer } = generateTaskId();
  const timestamp = Math.floor(Date.now() / 1000);
  // Deadline = 1 hour from now
  const deadline = timestamp + 3600;

  console.log(`\nRegistering task on-chain...`);
  console.log(`Task ID : ${taskId}`);
  try {
    const registerTx = await registerTask(
      connection,
      agentKeypair,
      agentKeypair.publicKey,
      taskIdBuffer,
      deadline,
    );
    console.log(`Register TX : ${registerTx}`);
  } catch (err: any) {
    console.error(`❌ Task registration failed: ${err?.message}`);
    return;
  }

  // ── Build & sign receipt ──────────────────────────────────────────────────

  const receipt = buildReceipt({
    taskId,
    agentId: agentKeypair.publicKey.toBase58(),
    instruction,
    action: decision,
    txSignature,
    timestamp,
  });

  const { outputHash, agentSignature } = signReceipt(receipt, agentKeypair);

  console.log(`\nOutput hash  : ${outputHash}`);
  console.log(`Agent sig    : ${agentSignature.slice(0, 16)}...`);

  // ── Submit to indexer (pins receipt to IPFS, stores receipt-cid) ─────────
  console.log("\nUploading receipt to indexer...");
  let cid: string;
  try {
    console.log(`Submitting to indexer at ${INDEXER_URL}...`);
    const indexerResult = await submitToIndexer(
      INDEXER_URL,
      taskId,
      { receipt, outputHash, agentSignature },
      timestamp,
      txSignature,
    );
    cid = indexerResult.cid;
    console.log(`Receipt CID  : ${cid}`);
  } catch (err: any) {
    console.error(`❌ Indexer upload failed: ${err?.message}`);
    return;
  }

  // ── Submit attestation on-chain ───────────────────────────────────────────
  console.log("\nSubmitting attestation on-chain...");
  let attestationTx: string;
  try {
    attestationTx = await submitAttestation(
      connection,
      agentKeypair, // attester = agent (pays fees)
      agentKeypair, // agent whose registry PDA is updated
      outputHash,
    );
    console.log(`Attestation TX : ${attestationTx}`);
    console.log(
      `Explorer       : https://solscan.io/tx/${attestationTx}?cluster=devnet`,
    );
  } catch (err: any) {
    console.error(`❌ Attestation failed: ${err?.message}`);
    return;
  }

  console.log(`\nFull loop complete!`);
  console.log(`  Claude parsed instruction    ✓`);
  console.log(`  SOL transfer executed        ✓`);
  console.log(`  output_hash signed by agent  ✓`);
  console.log(`  Receipt pinned to IPFS       ✓  (${cid})`);
  console.log(`  Attestation submitted        ✓`);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err?.message ?? err);
  process.exit(1);
});
