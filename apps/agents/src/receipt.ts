import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TransferAction } from "./execute";

export interface ExecutionReceipt {
  schema_version: "1.0";
  task_id: string;
  agent_id: string;
  instruction: string;
  timestamp_unix: number;
  execution: {
    tx_signature: string;
  };
  result: {
    status: "success" | "failed";
    summary: string;
  };
}

export interface SignedReceipt {
  receipt: ExecutionReceipt;
  outputHash: string; // hex — sha256(canonical receipt JSON)
  agentSignature: string; // hex — ed25519(outputHash, agentKeypair)
}

export function buildReceipt(params: {
  taskId: string;
  agentId: string;
  instruction: string;
  action: TransferAction;
  txSignature: string;
  timestamp: number;
}): ExecutionReceipt {
  return {
    schema_version: "1.0",
    task_id: params.taskId,
    agent_id: params.agentId,
    instruction: params.instruction,
    timestamp_unix: params.timestamp,
    execution: {
      tx_signature: params.txSignature,
    },
    result: {
      status: "success",
      summary: `Transferred ${params.action.amountSol} SOL to ${params.action.recipient}`,
    },
  };
}

export function signReceipt(
  receipt: ExecutionReceipt,
  agentKeypair: Keypair,
): SignedReceipt {
  // Canonical JSON — keys sorted alphabetically for determinism
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());

  // sha256 - output_hash stored on-chain
  const outputHashBytes = crypto
    .createHash("sha256")
    .update(canonical)
    .digest();
  const outputHash = outputHashBytes.toString("hex");

  // ed25519 signature — verified by submit_attestation() on-chain
  const signature = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
  const agentSignature = Buffer.from(signature).toString("hex");

  return { receipt, outputHash, agentSignature };
}

export function outputHashToBytes(outputHash: string): number[] {
  return Array.from(Buffer.from(outputHash, "hex"));
}
