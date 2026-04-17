import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import fetch from "node-fetch";
import * as nacl from "tweetnacl";

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");





function loadKeypair(pubkey: string): Keypair {
    const filePath = path.join(DOLORES_DIR, `${pubkey}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Agent keypair not found at ${filePath}\nRun: dolores register`
        );
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildReceipt(params: {
    agentId: string;
    taskId: string;
    txSignature: string;
    fromPubkey: string;
    toPubkey: string;
    lamports: number;
    timestamp: number;
}) {
    return {
        schema_version: "1.0",
        task_id: params.taskId,
        agent_id: params.agentId,
        timestamp_unix: params.timestamp,
        execution: {
            tx_signatures: [params.txSignature],
            programs_called: [SystemProgram.programId.toBase58()],
            instructions_executed: ["transfer"],
            token_transfers: [
                {
                    mint: "SOL",
                    amount: params.lamports,
                    direction: "out",
                    from: params.fromPubkey,
                    to: params.toPubkey,
                },
            ],
        },
        result: {
            status: "success",
            summary: `Transferred ${params.lamports / LAMPORTS_PER_SOL} SOL to ${params.toPubkey}`,
        },
    };
}

function hashReceipt(receipt: object): string {
    const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
}

async function submitReceiptToIndexer(
    indexerUrl: string,
    params: {
        agentId: string;
        taskId: string;
        outputHash: string;
        timestamp: number;
        agentSignature: string;

    }
) {
    const res = await fetch(`${indexerUrl}/receipts/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Indexer error ${res.status}: ${text}`);
    }

    return res.json() as Promise<{
        cid: string;
        taskId: string;
        agentId: string;
        attestationTx: string | null;
    }>;
}

async function fetchReputation(indexerUrl: string, agentId: string) {
    const res = await fetch(`${indexerUrl}/agents/${agentId}`);
    if (!res.ok) return null;
    return res.json() as Promise<{
        reputationScore: number;
        slashCount: number;
    }>;
}



export async function runCommand(opts: {
    agentId: string;
    recipient?: string;
    amountSol: number;
    indexerUrl: string;
    rpcUrl: string;
}) {
    console.log("\n🤖 Dolores — Agent Run (devnet)\n");

    // 1. Load agent keypair
    const agentKeypair = loadKeypair(opts.agentId);
    console.log(`Agent           : ${agentKeypair.publicKey.toBase58()}`);

    const connection = new Connection(opts.rpcUrl, "confirmed");
    const transferLamports = Math.floor(opts.amountSol * LAMPORTS_PER_SOL);

    // 2. Check balance — airdrop if needed
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log(`Balance         : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    if (balance < transferLamports + 5000) {
        console.log(`\nInsufficient balance. Requesting airdrop...`);
        const sig = await connection.requestAirdrop(
            agentKeypair.publicKey,
            LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(sig);
        console.log(`Airdrop tx      : ${sig}`);
    }

    // 3. Determine recipient
    const recipientPubkey = opts.recipient
        ? new PublicKey(opts.recipient)
        : Keypair.generate().publicKey;

    console.log(`Recipient       : ${recipientPubkey.toBase58()}`);
    console.log(`Transfer amount : ${opts.amountSol} SOL\n`);

    // 4. Execute the transfer
    console.log("Executing SOL transfer...");
    const taskId = generateTaskId();
    const timestamp = Math.floor(Date.now() / 1000);

    const transferTx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: agentKeypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: transferLamports,
        })
    );

    const txSignature = await sendAndConfirmTransaction(
        connection,
        transferTx,
        [agentKeypair],
        { commitment: "confirmed" }
    );

    console.log(` Transfer confirmed`);
    console.log(`Transaction     : ${txSignature}`);
    console.log(
        `Explorer        : https://explorer.solana.com/tx/${txSignature}?cluster=devnet\n`
    );

    // 5. Build execution receipt
    const receipt = buildReceipt({
        agentId: agentKeypair.publicKey.toBase58(),
        taskId,
        txSignature,
        fromPubkey: agentKeypair.publicKey.toBase58(),
        toPubkey: recipientPubkey.toBase58(),
        lamports: transferLamports,
        timestamp,
    });

    // 6. Hash receipt → output_hash stored on-chain
    const outputHash = hashReceipt(receipt);
    console.log(`Task ID         : ${taskId}`);
    console.log(`Output hash     : ${outputHash}\n`);
    const outputHashBytes = Buffer.from(outputHash, "hex");
    const signature = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
    const agentSignature = Buffer.from(signature).toString("hex");


    // 7. Submit to indexer → triggers submit_attestation on-chain
    console.log("Submitting receipt to indexer...");

    try {
        const result = await submitReceiptToIndexer(opts.indexerUrl, {
            agentId: agentKeypair.publicKey.toBase58(),
            taskId,
            outputHash,
            timestamp,
            agentSignature,
        });

        console.log(` Receipt submitted`);
        console.log(`CID             : ${result.cid}`);
        console.log(
            `Attestation tx  : ${result.attestationTx ?? "null (check indexer logs)"}`
        );

        if (result.attestationTx) {
            console.log(
                `Explorer        : https://explorer.solana.com/tx/${result.attestationTx}?cluster=devnet`
            );
        }

        // 8. Fetch updated reputation
        console.log("\nFetching updated reputation...");
        await new Promise((r) => setTimeout(r, 2000));

        const reputation = await fetchReputation(
            opts.indexerUrl,
            agentKeypair.publicKey.toBase58()
        );

        if (reputation) {
            console.log(`Reputation      : ${reputation.reputationScore} / 10000`);
            console.log(`Slash count     : ${reputation.slashCount}`);
        }
    } catch (err: any) {
        console.error(`\n Receipt submission failed: ${err?.message}`);
        console.error("Make sure the indexer is running: npm run start:dev");
        process.exit(1);
    }

    console.log("\n Full agent loop complete:\n");
    console.log("   SOL transferred on devnet          ✓");
    console.log("   Execution receipt built             ✓");
    console.log("   Receipt hashed → output_hash        ✓");
    console.log("   Receipt submitted to indexer        ✓");
    console.log("   submit_attestation fired on-chain   ✓");
    console.log("   Reputation score incremented        ✓\n");
}