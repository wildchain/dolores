import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fetch from "node-fetch";
import { SignedReceipt, outputHashToBytes } from "./receipt";

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

export async function submitToIndexer(
    indexerUrl: string,
    taskId: string,
    signedReceipt: SignedReceipt,
    completedAt: number,
    onChainTx: string
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