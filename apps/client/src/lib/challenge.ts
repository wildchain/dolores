import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { doloresAdjudicationIdl, PROGRAM_IDS } from "@dolores/contracts";

const ADJ_PROGRAM_ID = new PublicKey(PROGRAM_IDS.ADJUDICATION);
const FUND_PROGRAM_ID = new PublicKey(PROGRAM_IDS.FUND);

export type FailureType = "MissedDeadline" | "OutOfScopeCall";

export interface FileChallengeParams {
  /** Agent pubkey (base58) */
  agentId: string;
  /** Task ID as 64-char hex (32 bytes) */
  taskId: string;
  /** Operator pubkey (base58) — used to derive fund_account PDA */
  operatorId: string;
  failureType: FailureType;
  /** Proof data bytes — typically UTF-8 encoded receipt CID */
  proofData: Uint8Array;
  /** Challenger's wallet pubkey (signer + fee payer) */
  challengerPublicKey: PublicKey;
  connection: Connection;
}

export async function buildFileChallengeTransaction(
  params: FileChallengeParams,
): Promise<Transaction> {
  const {
    agentId,
    taskId,
    operatorId,
    failureType,
    proofData,
    challengerPublicKey,
    connection,
  } = params;

  const agentPubkey = new PublicKey(agentId);
  const operatorPubkey = new PublicKey(operatorId);
  const taskIdBuffer = Buffer.from(taskId, "hex");

  // Derive task_record PDA — seeds: ["task", agent, task_id]
  const [taskRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("task"), agentPubkey.toBuffer(), taskIdBuffer],
    ADJ_PROGRAM_ID,
  );

  // Derive challenge PDA — seeds: ["challenge", agent, task_id]
  const [challengePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("challenge"), agentPubkey.toBuffer(), taskIdBuffer],
    ADJ_PROGRAM_ID,
  );

  // Derive adjudication authority PDA — seeds: ["authority"]
  const [adjudicationAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    ADJ_PROGRAM_ID,
  );

  // Derive fund_account PDA from fund program — seeds: ["fund", operator, agent]
  const [fundAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("fund"), operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
    FUND_PROGRAM_ID,
  );

  // Build a read-only provider — wallet signing happens in the UI layer
  const provider = new AnchorProvider(
    connection,
    {} as any,
    AnchorProvider.defaultOptions(),
  );
  const adjProgram = new Program(doloresAdjudicationIdl as any, provider);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = challengerPublicKey;

  // Anchor enum variant format: { variantName: {} }
  const failureTypeArg =
    failureType === "MissedDeadline"
      ? { missedDeadline: {} }
      : { outOfScopeCall: {} };

  const challengeIx = await (adjProgram.methods as any)
    .fileChallenge(failureTypeArg, Buffer.from(proofData))
    .accounts({
      challenger: challengerPublicKey,
      taskRecord: taskRecordPda,
      challenge: challengePda,
      adjudicationAuthority,
      fundAccount,
      fundProgram: FUND_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(challengeIx);

  return tx;
}

/** Returns true if taskId is a valid 64-char lowercase hex string (32 bytes). */
export function isValidTaskId(taskId: string): boolean {
  console.log("Validating task ID:", taskId);
  return /^[0-9a-f]{64}$/.test(taskId);
}

/** Returns true if value looks like a valid base58 Solana pubkey. */
export function isValidPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}
