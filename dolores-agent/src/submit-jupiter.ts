import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import fetch from "node-fetch";
import { SwapAction } from "./execute-jupiter";
import { outputHashToBytes } from "./receipt";

const TASK_SEED      = Buffer.from("task");
const ADJ_PROGRAM_ID = "8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A";
const JUPITER_V6     = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

const BASE    = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY!;

// Mainnet connection — for Jupiter swap only
const mainnetConnection = new Connection(
  process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// ─── Jupiter API helper ───────────────────────────────────────────────────────

async function jupiterFetch<T>(path: string, init?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": API_KEY,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Step 1: Execute Jupiter swap on MAINNET ──────────────────────────────────

export async function executeJupiterSwap(
  agentKeypair: Keypair,
  action: SwapAction
): Promise<{ txSignature: string; inputAmount: string; outputAmount: string }> {

  console.log(`   Using mainnet RPC: ${process.env.JUPITER_RPC_URL || "https://api.mainnet-beta.solana.com"}`);

  // 1a. Get order
  const params = new URLSearchParams({
    inputMint:  action.inputMint,
    outputMint: action.outputMint,
    amount:     action.amountLamports.toString(),
    taker:      agentKeypair.publicKey.toBase58(),
  });

  const order = await jupiterFetch<{
    transaction: string | null;
    requestId:   string;
    error?:      string;
  }>(`/swap/v2/order?${params}`);

  if (order.error || !order.transaction) {
    throw new Error(`Jupiter order failed: ${order.error ?? "no transaction"}`);
  }

  // 1b. Sign transaction
  const tx = VersionedTransaction.deserialize(
    Buffer.from(order.transaction, "base64")
  );
  tx.sign([agentKeypair]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");

  // 1c. Execute — Jupiter submits on your behalf, no Connection needed
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

  return {
    txSignature:  result.signature,
    inputAmount:  result.inputAmountResult  ?? action.amountLamports.toString(),
    outputAmount: result.outputAmountResult ?? "0",
  };
}

// ─── Step 2: Build receipt ────────────────────────────────────────────────────

export function buildJupiterReceipt(params: {
  taskId:       string;
  agentId:      string;
  instruction:  string;
  action:       SwapAction;
  txSignature:  string;
  inputAmount:  string;
  outputAmount: string;
  timestamp:    number;
}) {
  return {
    schema_version: "1.0",
    task_id:        params.taskId,
    agent_id:       params.agentId,
    instruction:    params.instruction,
    timestamp_unix: params.timestamp,
    execution: {
      tx_signatures:         [params.txSignature],
      programs_called:       [JUPITER_V6],
      instructions_executed: ["swap"],
      token_transfers: [
        {
          mint:      params.action.inputMint,
          amount:    parseInt(params.inputAmount),
          direction: "out" as const,
          from:      params.agentId,
          to:        JUPITER_V6,
        },
        {
          mint:      params.action.outputMint,
          amount:    parseInt(params.outputAmount),
          direction: "in" as const,
          from:      JUPITER_V6,
          to:        params.agentId,
        },
      ],
    },
    result: {
      status:  "success" as const,
      summary: `Swapped ${params.action.amountSol} ${params.action.inputSymbol} → ${params.action.outputSymbol}. Got ${params.outputAmount} ${params.action.outputSymbol}`,
    },
  };
}

// ─── Step 3: Sign receipt ─────────────────────────────────────────────────────

export function signJupiterReceipt(
  receipt: object,
  agentKeypair: Keypair
): { outputHash: string; agentSignature: string } {
  const canonical       = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto.createHash("sha256").update(canonical).digest();
  const outputHash      = outputHashBytes.toString("hex");
  const signature       = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
  const agentSignature  = Buffer.from(signature).toString("hex");
  return { outputHash, agentSignature };
}

// ─── Step 4: complete_task() on DEVNET ────────────────────────────────────────

export async function completeJupiterTaskOnChain(
  devnetConnection: Connection,  // devnet — Dolores programs live here
  agentKeypair: Keypair,
  adjProgram: Program,
  taskId: Buffer,
  outputHash: string
): Promise<string> {
  const [taskPda] = PublicKey.findProgramAddressSync(
    [TASK_SEED, agentKeypair.publicKey.toBuffer(), taskId],
    new PublicKey(ADJ_PROGRAM_ID)
  );

  const tx = await (adjProgram.methods as any)
    .completeTask(outputHashToBytes(outputHash))
    .accounts({
      agent:      agentKeypair.publicKey,
      taskRecord: taskPda,
    })
    .transaction();

  return sendAndConfirmTransaction(devnetConnection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}