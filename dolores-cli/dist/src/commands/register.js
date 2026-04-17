"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommand = registerCommand;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const dolores_registry_json_1 = __importDefault(require("../idl/dolores_registry.json"));
// import idlJson from "../../../dolores-programs/target/idl/dolores_registry.json";
const templates_1 = require("../templates");
// ─── Constants ────────────────────────────────────────────────
const REGISTRY_SEED = Buffer.from("registry");
const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
// ─── Helpers ──────────────────────────────────────────────────
function ensureDoloresDir() {
    if (!fs.existsSync(DOLORES_DIR)) {
        fs.mkdirSync(DOLORES_DIR, { recursive: true });
    }
}
function saveKeypair(keypair) {
    ensureDoloresDir();
    const pubkey = keypair.publicKey.toBase58();
    const filePath = path.join(DOLORES_DIR, `${pubkey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)));
    return filePath;
}
function loadKeypairFromFile(filePath) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(raw));
}
function deriveRegistryPda(agentPubkey, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([REGISTRY_SEED, agentPubkey.toBuffer()], programId);
}
function prompt(question) {
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
// ─── Main register command ─────────────────────────────────────
async function registerCommand(opts) {
    console.log("\n🤖 Dolores — Agent Registration\n");
    // 1. Load operator wallet
    const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
    console.log(`Operator wallet : ${operatorKeypair.publicKey.toBase58()}`);
    // 2. Generate agent keypair — developer doesn't need one upfront
    const agentKeypair = web3_js_1.Keypair.generate();
    console.log(`Agent keypair   : ${agentKeypair.publicKey.toBase58()} (new)\n`);
    // 3. Pick capability template sourced from solana.com/skills
    console.log("Available capability templates (sourced from solana.com/skills):\n");
    console.log((0, templates_1.templateChoices)());
    console.log();
    const templateInput = await prompt(`Select template (1–${Object.keys(templates_1.CAPABILITY_TEMPLATES).length}): `);
    const selection = (0, templates_1.templateByIndex)(parseInt(templateInput));
    if (!selection) {
        console.error("Invalid selection.");
        process.exit(1);
    }
    const [templateKey, manifest] = selection;
    const capabilityHashBuffer = (0, templates_1.hashManifest)(manifest);
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
    const manifestPath = path.join(DOLORES_DIR, `${agentKeypair.publicKey.toBase58()}.manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest saved  → ${manifestPath}\n`);
    // 7. Build and send transaction — operator and agent both sign
    const connection = new web3_js_1.Connection(opts.rpcUrl, "confirmed");
    const wallet = new anchor_1.Wallet(operatorKeypair);
    const provider = new anchor_1.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const programId = new web3_js_1.PublicKey(opts.programId);
    const [registryPda] = deriveRegistryPda(agentKeypair.publicKey, programId);
    console.log(`Registry PDA    : ${registryPda.toBase58()}`);
    const program = new anchor.Program(dolores_registry_json_1.default, provider);
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
        console.log("✅ Agent registered successfully!");
        console.log(`Transaction     : ${tx}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        console.log(`\nAgent pubkey    : ${agentKeypair.publicKey.toBase58()}`);
        console.log(`Registry PDA    : ${registryPda.toBase58()}`);
        console.log(`Template        : ${templateKey}`);
        console.log(`\nNext step       : dolores stake --agent-id ${agentKeypair.publicKey.toBase58()} --amount 100`);
    }
    catch (err) {
        console.error("\n❌ Registration failed:");
        console.error(err?.message ?? err);
        // Clean up saved files so user can retry cleanly
        [savedPath, manifestPath].forEach((f) => {
            if (fs.existsSync(f))
                fs.unlinkSync(f);
        });
        console.log("Keypair and manifest files removed (tx failed — nothing registered).");
        process.exit(1);
    }
}
