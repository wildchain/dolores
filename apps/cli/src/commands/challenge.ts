import {
    Keypair,
    Connection,
    PublicKey,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as crypto from "crypto";
import idlAdjudication from "../idl/dolores_adjudication.json";
import {
    ADJ_PROGRAM_ID,
    FUND_PROGRAM_ID,
    REGISTRY_PROGRAM_ID,
    TREASURY_PUBKEY,
    TASK_SEED,
    CHALLENGE_SEED,
    AUTHORITY_SEED,
    FUND_SEED,
    VAULT_SEED,
    REGISTRY_SEED,
} from "../constants";

function loadKeypairFromFile(filePath: string): Keypair {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export async function challengeCommand(opts: {
    agentId: string;
    failureType: string;
    operatorKeyPath: string;
    rpcUrl: string;
}) {
    console.log("\n⚖️  Dolores — File Challenge\n");

    if (opts.failureType !== "missed-deadline" && opts.failureType !== "out-of-scope-call") {
        console.error(`❌ Invalid failure type: ${opts.failureType}`);
        console.error(`   Valid types: missed-deadline | out-of-scope-call`);
        process.exit(1);
    }

    const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
    const agentPubkey = new PublicKey(opts.agentId);

    console.log(`Operator        : ${operatorKeypair.publicKey.toBase58()}`);
    console.log(`Agent           : ${opts.agentId}`);
    console.log(`Failure type    : ${opts.failureType}\n`);

    const connection = new Connection(opts.rpcUrl, "confirmed");
    const wallet = new Wallet(operatorKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const adjProgram = new Program(idlAdjudication as any, provider) as any;
    const fundProgId = new PublicKey(FUND_PROGRAM_ID);
    const registryProgId = new PublicKey(REGISTRY_PROGRAM_ID);
    const adjProgId = new PublicKey(ADJ_PROGRAM_ID);

    const taskId = crypto.randomBytes(32);

    const [taskPda] = PublicKey.findProgramAddressSync(
        [TASK_SEED, agentPubkey.toBuffer(), taskId], adjProgId
    );
    const [challengePda] = PublicKey.findProgramAddressSync(
        [CHALLENGE_SEED, agentPubkey.toBuffer(), taskId], adjProgId
    );
    const [authorityPda] = PublicKey.findProgramAddressSync(
        [AUTHORITY_SEED], adjProgId
    );
    const [fundPda] = PublicKey.findProgramAddressSync(
        [FUND_SEED, operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()], fundProgId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()], fundProgId
    );
    const [registryPda] = PublicKey.findProgramAddressSync(
        [REGISTRY_SEED, agentPubkey.toBuffer()], registryProgId
    );

    console.log(`Task ID         : ${taskId.toString("hex").slice(0, 16)}...`);
    console.log(`Task PDA        : ${taskPda.toBase58()}`);
    console.log(`Challenge PDA   : ${challengePda.toBase58()}`);
    console.log(`Authority PDA   : ${authorityPda.toBase58()}\n`);

    const now = Math.floor(Date.now() / 1000);
    const deadline = opts.failureType === "missed-deadline" ? now + 3 : now + 3600;

    const instruction = opts.failureType === "missed-deadline"
        ? "transfer 0.001 SOL to 9HV6oz8jWhWcArhA4Upv3NWEKB6PGMqHWbCkTzwDdFuX"
        : "swap 1 SOL to USDC on Jupiter";

    console.log("Step 1/3 — Registering task on-chain...");
    try {
        const tx1 = await adjProgram.methods
            .registerTask(Array.from(taskId), new BN(deadline), instruction)
            .accounts({
                user: operatorKeypair.publicKey,
                agent: agentPubkey,
                taskRecord: taskPda,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();
        console.log(` Task registered`);
        console.log(`Transaction     : ${tx1}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx1}?cluster=devnet\n`);
    } catch (err: any) {
        console.error(` register_task failed: ${err?.message ?? err}`);
        process.exit(1);
    }

    if (opts.failureType === "missed-deadline") {
        console.log("Waiting 5 seconds for deadline to pass...");
        await new Promise((r) => setTimeout(r, 5000));
    }

    const proofData = opts.failureType === "out-of-scope-call"
        ? [...new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4").toBuffer()]
        : [0x01];

    console.log("Step 2/3 — Filing challenge...");
    try {
        const failureTypeArg = opts.failureType === "missed-deadline"
            ? { missedDeadline: {} }
            : { outOfScopeCall: {} };

        const tx2 = await adjProgram.methods
            .fileChallenge(failureTypeArg, Buffer.from(proofData))
            .accounts({
                challenger: operatorKeypair.publicKey,
                taskRecord: taskPda,
                challenge: challengePda,
                adjudicationAuthority: authorityPda,
                fundAccount: fundPda,
                fundProgram: fundProgId,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();
        console.log(` Challenge filed`);
        console.log(`Transaction     : ${tx2}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx2}?cluster=devnet\n`);
    } catch (err: any) {
        console.error(` file_challenge failed: ${err?.message ?? err}`);
        process.exit(1);
    }

    console.log("Step 3/3 — Auto-adjudicating...");
    try {
        const tx3 = await adjProgram.methods
            .autoAdjudicate()
            .accounts({
                caller: operatorKeypair.publicKey,
                taskRecord: taskPda,
                challenge: challengePda,
                adjudicationAuthority: authorityPda,
                fundAccount: fundPda,
                vault: vaultPda,
                challenger: operatorKeypair.publicKey,
                treasury: new PublicKey(TREASURY_PUBKEY),
                registry: registryPda,
                fundProgram: fundProgId,
                registryProgram: registryProgId,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();
        console.log(` Auto-adjudicated`);
        console.log(`Transaction     : ${tx3}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx3}?cluster=devnet\n`);
    } catch (err: any) {
        console.error(` auto_adjudicate failed: ${err?.message ?? err}`);
        process.exit(1);
    }

    console.log(` Challenge complete!\n`);
    console.log(`   Task registered on-chain       ✓`);
    console.log(`   Challenge filed with bond       ✓`);
    console.log(`   Auto-adjudicated on-chain       ✓`);
    console.log(`   Slash executed (if valid proof) ✓\n`);
    console.log(`Check updated reputation:`);
    console.log(`   dolores history --agent-id ${opts.agentId}`);
    console.log(`   dolores verify  --agent-id ${opts.agentId} --min-rep 0 --min-stake 0.1\n`);
}