import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import fetch from "node-fetch";
import { executeJupiterTask } from "./execute-jupiter";

// Config 

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID    = process.env.AGENT_ID!;
const JUPITER_API_KEY = process.env.JUPITER_API_KEY!;
const BASE        = "https://api.jup.ag";

const SOL_MINT  = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPITER_V6 = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

if (!AGENT_ID)        { console.error("❌ AGENT_ID required"); process.exit(1); }
if (!JUPITER_API_KEY) { console.error("❌ JUPITER_API_KEY required"); process.exit(1); }

//  Load keypair 

function loadKeypair(agentId: string): Keypair {
  const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ Keypair not found at ${keyPath}`);
    process.exit(1);
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8")))
  );
}

//  Jupiter helpers 

async function jupiterFetch<T>(path: string, init?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": JUPITER_API_KEY, ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

//  Main 

async function main() {
  const instruction = process.argv[2] || "swap 0.001 SOL to USDC";

  console.log("\n🚀 Dolores Jupiter Test (mainnet, no on-chain Dolores)\n");
  console.log(`Agent       : ${AGENT_ID}`);
  console.log(`Instruction : ${instruction}\n`);

  const agentKeypair = loadKeypair(AGENT_ID);
  console.log(`Wallet      : ${agentKeypair.publicKey.toBase58()}`);

  //  Step 1: Claude parses instruction 
  console.log("\n🤖 Asking Claude...");
  const decision = await executeJupiterTask(instruction);
  console.log(`Decision    : ${JSON.stringify(decision, null, 2)}`);

  if (decision.action === "reject") {
    console.log(`\n⚠️  Rejected: ${decision.reason}`);
    process.exit(0);
  }

  //  Step 2: Get Jupiter order 
  console.log("\n📡 Getting Jupiter swap order...");
  const params = new URLSearchParams({
    inputMint:  decision.inputMint,
    outputMint: decision.outputMint,
    amount:     decision.amountLamports.toString(),
    taker:      agentKeypair.publicKey.toBase58(),
  });

  const order = await jupiterFetch<{
    transaction: string | null;
    requestId:   string;
    error?:      string;
  }>(`/swap/v2/order?${params}`);

  if (order.error || !order.transaction) {
    throw new Error(`Order failed: ${order.error ?? "no transaction"}`);
  }

  console.log(`Request ID  : ${order.requestId}`);

  //  Step 3: Sign transaction 
  console.log("\n✍️  Signing transaction...");
  const tx = VersionedTransaction.deserialize(
    Buffer.from(order.transaction, "base64")
  );
  tx.sign([agentKeypair]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");
  console.log(`Signed      : ✅`);

  //  Step 4: Execute swap 
  console.log("\n⚡ Executing swap on mainnet...");
  const result = await jupiterFetch<{
    status:              string;
    signature:           string;
    code:                number;
    inputAmountResult?:  string;
    outputAmountResult?: string;
    error?:              string;
  }>("/swap/v2/execute", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction: signedTx,
      requestId:         order.requestId,
    }),
  });

  if (result.status !== "Success") {
    throw new Error(`Swap failed (code ${result.code}): ${result.error}`);
  }

  console.log(`✅ Swap confirmed!`);
  console.log(`TX          : ${result.signature}`);
  console.log(`Explorer    : https://solscan.io/tx/${result.signature}`);
  console.log(`Input       : ${result.inputAmountResult} lamports SOL`);
  console.log(`Output      : ${result.outputAmountResult} USDC (6 decimals)`);

  //  Step 5: Build + sign receipt 
  console.log("\n📝 Building execution receipt...");
  const timestamp = Math.floor(Date.now() / 1000);
  const taskId    = `jupiter-test-${timestamp}`;

  const receipt = {
    schema_version: "1.0",
    task_id:        taskId,
    agent_id:       agentKeypair.publicKey.toBase58(),
    instruction,
    timestamp_unix: timestamp,
    execution: {
      tx_signatures:         [result.signature],
      programs_called:       [JUPITER_V6],
      instructions_executed: ["swap"],
      token_transfers: [
        {
          mint:      decision.inputMint,
          amount:    parseInt(result.inputAmountResult ?? "0"),
          direction: "out",
          from:      agentKeypair.publicKey.toBase58(),
          to:        JUPITER_V6,
        },
        {
          mint:      decision.outputMint,
          amount:    parseInt(result.outputAmountResult ?? "0"),
          direction: "in",
          from:      JUPITER_V6,
          to:        agentKeypair.publicKey.toBase58(),
        },
      ],
    },
    result: {
      status:  "success",
      summary: `Swapped ${decision.amountSol} SOL → ${result.outputAmountResult} USDC`,
    },
  };

  // Step 6: Hash + sign 
  const canonical       = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto.createHash("sha256").update(canonical).digest();
  const outputHash      = outputHashBytes.toString("hex");
  const signature       = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
  const agentSignature  = Buffer.from(signature).toString("hex");

  console.log(`Output hash : ${outputHash}`);
  console.log(`Agent sig   : ${agentSignature.slice(0, 16)}...`);

  //  Summary 
  console.log("\n✅ Full Jupiter agent loop complete!\n");
  console.log(`   Claude parsed instruction          ✓`);
  console.log(`   Jupiter swap executed on mainnet   ✓`);
  console.log(`   Execution receipt built            ✓`);
  console.log(`   output_hash signed by agent        ✓`);
  console.log(`\n   TX: https://solscan.io/tx/${result.signature}`);
  console.log(`\n   Note: Dolores on-chain accounting skipped`);
  console.log(`   (register_task + complete_task + attestation need mainnet deploy)`);
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err?.message ?? err);
  process.exit(1);
});