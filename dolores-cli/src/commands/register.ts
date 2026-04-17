import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idlJson from "../idl/dolores_registry.json";
// import idlJson from "../../../dolores-programs/target/idl/dolores_registry.json";
import {
    hashManifest,
    templateChoices,
    templateByIndex,
    CAPABILITY_TEMPLATES,
} from "../templates";

// Constants

const REGISTRY_SEED = Buffer.from("registry");
const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");

// Helpers 

function ensureDoloresDir() {
    if (!fs.existsSync(DOLORES_DIR)) {
        fs.mkdirSync(DOLORES_DIR, { recursive: true });
    }
}

function saveKeypair(keypair: Keypair): string {
    ensureDoloresDir();
    const pubkey = keypair.publicKey.toBase58();
    const filePath = path.join(DOLORES_DIR, `${pubkey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)));
    return filePath;
}

function loadKeypairFromFile(filePath: string): Keypair {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function deriveRegistryPda(
    agentPubkey: PublicKey,
    programId: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [REGISTRY_SEED, agentPubkey.toBuffer()],
        programId
    );
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

//  Main register command 
export async function registerCommand(opts: {
    operatorKeyPath: string;
    programId: string;
    rpcUrl: string;
}) {
    console.log("\n🤖 Dolores — Agent Registration\n");

    // 1. Load operator wallet
    const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
    console.log(`Operator wallet : ${operatorKeypair.publicKey.toBase58()}`);

    // 2. Generate agent keypair — developer doesn't need one upfront
    const agentKeypair = Keypair.generate();
    console.log(`Agent keypair   : ${agentKeypair.publicKey.toBase58()} (new)\n`);

    // 3. Pick capability template sourced from solana.com/skills
    console.log("Available capability templates (sourced from solana.com/skills):\n");
    console.log(templateChoices());
    console.log();

    const templateInput = await prompt(
        `Select template (1–${Object.keys(CAPABILITY_TEMPLATES).length}): `
    );
    const selection = templateByIndex(parseInt(templateInput));

    if (!selection) {
        console.error("Invalid selection.");
        process.exit(1);
    }

    const [templateKey, manifest] = selection;
    const capabilityHashBuffer = hashManifest(manifest);

    console.log(`\nTemplate        : ${templateKey}`);
    console.log(`Skill reference : ${manifest.skill_ref}`);
    console.log(`Allowed programs:`);
    manifest.allowed_programs.forEach((p) => console.log(`  ${p}`));
    console.log(`Max transfer    : ${manifest.max_transfer_usdc.toLocaleString()} USDC`);
    console.log(`Capability hash : ${capabilityHashBuffer.toString("hex")}`);

    // 4. Confirm
    const confirm = await prompt("\nRegister this agent on-chain? (yes/no): ");
    if (confirm.toLowerCase() !== "yes") {
        console.log("Aborted.");
        process.exit(0);
    }

    // 5. Save agent keypair to ~/.dolores/agents/<pubkey>.json
    const savedPath = saveKeypair(agentKeypair);
    console.log(`\nAgent keypair saved → ${savedPath}`);
    console.log("Keep this file safe — it's the agent's signing identity.\n");

    // 6. Save manifest alongside keypair for the watcher to reference
    const manifestPath = path.join(
        DOLORES_DIR,
        `${agentKeypair.publicKey.toBase58()}.manifest.json`
    );
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest saved  → ${manifestPath}\n`);

    // 7. Build and send transaction — operator and agent both sign
    const connection = new Connection(opts.rpcUrl, "confirmed");
    const wallet = new Wallet(operatorKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const programId = new PublicKey(opts.programId);
    const [registryPda] = deriveRegistryPda(agentKeypair.publicKey, programId);

    console.log(`Registry PDA    : ${registryPda.toBase58()}`);

    const program = new anchor.Program(idlJson as any, provider) as any;

    console.log("Sending registration transaction...\n");

    try {
        const tx = await program.methods
            .registerAgent(Array.from(capabilityHashBuffer))
            .accounts({
                operator: operatorKeypair.publicKey,
                agent: agentKeypair.publicKey,
            })
            .signers([agentKeypair])
            .rpc();

        console.log(" Agent registered successfully!");
        console.log(`Transaction     : ${tx}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        console.log(`\nAgent pubkey    : ${agentKeypair.publicKey.toBase58()}`);
        console.log(`Registry PDA    : ${registryPda.toBase58()}`);
        console.log(`Template        : ${templateKey}`);
        console.log(`\nNext step       : dolores stake --agent-id ${agentKeypair.publicKey.toBase58()} --amount 100`);
    } catch (err: any) {
        console.error("\n Registration failed:");
        console.error(err?.message ?? err);

        // Clean up saved files so user can retry cleanly
        [savedPath, manifestPath].forEach((f) => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        console.log("Keypair and manifest files removed (tx failed — nothing registered).");
        process.exit(1);
    }
}