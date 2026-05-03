import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as nacl from "tweetnacl";
import fetch from "node-fetch";
import { SignedReceipt, outputHashToBytes } from "./receipt";
import { DoloresPrograms } from "@dolores/solana-utils";

const TASK_SEED = Buffer.from("task");
const ADJ_PROGRAM_ID = "8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A"; // redeployed

export interface SubmitResult {
  txSignature: string;
  attestationTx: string | null;
  cid: string;
}

export async function executeSolTransfer(
  connection: Connection,
  agentKeypair: Keypair,
  recipient: string,
  amountLamports: number,
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: agentKeypair.publicKey,
      toPubkey: new PublicKey(recipient),
      lamports: amountLamports,
    }),
  );
  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

export async function completeTaskOnChain(
  connection: Connection,
  agentKeypair: Keypair,
  adjProgram: Program,
  taskId: Buffer,
  outputHash: string,
): Promise<string> {
  const [taskPda] = PublicKey.findProgramAddressSync(
    [TASK_SEED, agentKeypair.publicKey.toBuffer(), taskId],
    new PublicKey(ADJ_PROGRAM_ID),
  );

  const tx = await (adjProgram.methods as any)
    .completeTask(outputHashToBytes(outputHash))
    .accounts({
      agent: agentKeypair.publicKey,
      taskRecord: taskPda,
    })
    .transaction();

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

export async function submitToIndexer(
  indexerUrl: string,
  taskId: string,
  signedReceipt: SignedReceipt,
  completedAt: number,
  onChainTx: string,
): Promise<{ attestationTx: string | null; cid: string }> {
  await fetch(`${indexerUrl}/tasks/${taskId}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outputHash: signedReceipt.outputHash,
      completedAt,
    }),
  });

  const res = await fetch(`${indexerUrl}/receipts/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: signedReceipt.receipt.agent_id,
      taskId: signedReceipt.receipt.task_id,
      outputHash: signedReceipt.outputHash,
      timestamp: signedReceipt.receipt.timestamp_unix,
      agentSignature: signedReceipt.agentSignature,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Indexer receipt upload failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    cid: string;
    attestationTx: string | null;
  };

  return { attestationTx: data.attestationTx, cid: data.cid };
}

/**
 * Submit an attestation directly on-chain after a completed task.
 *
 * The transaction contains two instructions:
 *   1. Ed25519SigVerify — proves the agent signed the output_hash
 *   2. submit_attestation — records the score on the registry account
 *
 * @param connection  Solana connection (devnet or mainnet)
 * @param attesterKeypair  Keypair that pays fees and signs the tx (can be the agent itself)
 * @param agentKeypair     Agent keypair whose registry PDA is updated and whose key signed outputHash
 * @param outputHashHex    Hex-encoded sha256 of the execution receipt
 * @param score            Task score 0–100
 * @param stakeWeight      Stake weight 0–10
 */
export async function submitAttestation(
  connection: Connection,
  attesterKeypair: Keypair,
  agentKeypair: Keypair,
  outputHashHex: string,
  score: number = 80,
  stakeWeight: number = 1,
): Promise<string> {
  const programs = await DoloresPrograms.getInstance(connection.rpcEndpoint);
  const registryProgram = programs.getRegistryProgram();
  const [registryPda] = programs.deriveRegistryPda(agentKeypair.publicKey);

  // Sign the output_hash with the agent key — verified by the on-chain Ed25519 check
  const outputHashBytes = Buffer.from(outputHashHex, "hex");
  const agentSignatureBytes = nacl.sign.detached(
    outputHashBytes,
    agentKeypair.secretKey,
  );

  // Instruction 1: Ed25519 signature verification
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: agentKeypair.publicKey.toBytes(),
    message: outputHashBytes,
    signature: agentSignatureBytes,
  });

  // Instruction 2: submit_attestation via Anchor
  const attestationIx = await (registryProgram.methods as any)
    .submitAttestation(
      score,
      Array.from(outputHashBytes),
      Array.from(agentSignatureBytes),
      stakeWeight,
    )
    .accounts({
      attester: attesterKeypair.publicKey,
      registry: registryPda,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  const tx = new Transaction().add(ed25519Ix, attestationIx);

  return sendAndConfirmTransaction(connection, tx, [attesterKeypair], {
    commitment: "confirmed",
  });
}
