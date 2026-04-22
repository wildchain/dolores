import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import fetch from "node-fetch";
import { SignedReceipt, outputHashToBytes } from "./receipt";

const TASK_SEED = Buffer.from("task");
const ADJ_PROGRAM_ID = "4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz";

// Types 

export interface SubmitResult {
    txSignature: string;    // complete_task() on-chain tx
    attestationTx: string | null; // submit_attestation() tx from indexer
    cid: string;
}

//  Step 1: execute SOL transfer 

export async function executeSolTransfer(
    connection: Connection,
    agentKeypair: Keypair,
    recipient: string,
    amountLamports: number
): Promise<string> {
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: agentKeypair.publicKey,
            toPubkey: new PublicKey(recipient),
            lamports: amountLamports,
        })
    );

    return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
        commitment: "confirmed",
    });
}

//  Step 2: complete_task() on-chain 

export async function completeTaskOnChain(
    connection: Connection,
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
            agent: agentKeypair.publicKey,
            taskRecord: taskPda,
        })
        .transaction();

    return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
        commitment: "confirmed",
    });
}

// Step 3: PATCH indexer + POST receipt

export async function submitToIndexer(
    indexerUrl: string,
    taskId: string,
    signedReceipt: SignedReceipt,
    completedAt: number,
    onChainTx: string
): Promise<{ attestationTx: string | null; cid: string }> {
    // 3a. Mark task completed in indexer DB
    await fetch(`${indexerUrl}/tasks/${taskId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            outputHash: signedReceipt.outputHash,
            completedAt,
        }),
    });

    // 3b. Submit receipt - triggers submit_attestation() on-chain
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