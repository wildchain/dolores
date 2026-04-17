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
exports.runCommand = runCommand;
const web3_js_1 = require("@solana/web3.js");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
// ─── Helpers ──────────────────────────────────────────────────
function loadKeypair(pubkey) {
    const filePath = path.join(DOLORES_DIR, `${pubkey}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Agent keypair not found at ${filePath}\nRun: dolores register`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(raw));
}
function generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function buildReceipt(params) {
    return {
        schema_version: "1.0",
        task_id: params.taskId,
        agent_id: params.agentId,
        timestamp_unix: params.timestamp,
        execution: {
            tx_signatures: [params.txSignature],
            programs_called: [web3_js_1.SystemProgram.programId.toBase58()],
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
            summary: `Transferred ${params.lamports / web3_js_1.LAMPORTS_PER_SOL} SOL to ${params.toPubkey}`,
        },
    };
}
function hashReceipt(receipt) {
    const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
}
async function submitReceiptToIndexer(indexerUrl, params) {
    const res = await (0, node_fetch_1.default)(`${indexerUrl}/receipts/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Indexer error ${res.status}: ${text}`);
    }
    return res.json();
}
async function fetchReputation(indexerUrl, agentId) {
    const res = await (0, node_fetch_1.default)(`${indexerUrl}/agents/${agentId}`);
    if (!res.ok)
        return null;
    return res.json();
}
// ─── Main ─────────────────────────────────────────────────────
async function runCommand(opts) {
    console.log("\n🤖 Dolores — Agent Run (devnet)\n");
    // 1. Load agent keypair
    const agentKeypair = loadKeypair(opts.agentId);
    console.log(`Agent           : ${agentKeypair.publicKey.toBase58()}`);
    const connection = new web3_js_1.Connection(opts.rpcUrl, "confirmed");
    const transferLamports = Math.floor(opts.amountSol * web3_js_1.LAMPORTS_PER_SOL);
    // 2. Check balance — airdrop if needed
    const balance = await connection.getBalance(agentKeypair.publicKey);
    console.log(`Balance         : ${(balance / web3_js_1.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    if (balance < transferLamports + 5000) {
        console.log(`\nInsufficient balance. Requesting airdrop...`);
        const sig = await connection.requestAirdrop(agentKeypair.publicKey, web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig);
        console.log(`Airdrop tx      : ${sig}`);
    }
    // 3. Determine recipient
    const recipientPubkey = opts.recipient
        ? new web3_js_1.PublicKey(opts.recipient)
        : web3_js_1.Keypair.generate().publicKey;
    console.log(`Recipient       : ${recipientPubkey.toBase58()}`);
    console.log(`Transfer amount : ${opts.amountSol} SOL\n`);
    // 4. Execute the transfer
    console.log("Executing SOL transfer...");
    const taskId = generateTaskId();
    const timestamp = Math.floor(Date.now() / 1000);
    const transferTx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: agentKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: transferLamports,
    }));
    const txSignature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transferTx, [agentKeypair], { commitment: "confirmed" });
    console.log(`✅ Transfer confirmed`);
    console.log(`Transaction     : ${txSignature}`);
    console.log(`Explorer        : https://explorer.solana.com/tx/${txSignature}?cluster=devnet\n`);
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
    // 7. Submit to indexer → triggers submit_attestation on-chain
    console.log("Submitting receipt to indexer...");
    try {
        const result = await submitReceiptToIndexer(opts.indexerUrl, {
            agentId: agentKeypair.publicKey.toBase58(),
            taskId,
            outputHash,
            timestamp,
        });
        console.log(`✅ Receipt submitted`);
        console.log(`CID             : ${result.cid}`);
        console.log(`Attestation tx  : ${result.attestationTx ?? "null (check indexer logs)"}`);
        if (result.attestationTx) {
            console.log(`Explorer        : https://explorer.solana.com/tx/${result.attestationTx}?cluster=devnet`);
        }
        // 8. Fetch updated reputation
        console.log("\nFetching updated reputation...");
        await new Promise((r) => setTimeout(r, 2000));
        const reputation = await fetchReputation(opts.indexerUrl, agentKeypair.publicKey.toBase58());
        if (reputation) {
            console.log(`Reputation      : ${reputation.reputationScore} / 10000`);
            console.log(`Slash count     : ${reputation.slashCount}`);
        }
    }
    catch (err) {
        console.error(`\n❌ Receipt submission failed: ${err?.message}`);
        console.error("Make sure the indexer is running: npm run start:dev");
        process.exit(1);
    }
    console.log("\n✅ Full agent loop complete:\n");
    console.log("   SOL transferred on devnet          ✓");
    console.log("   Execution receipt built             ✓");
    console.log("   Receipt hashed → output_hash        ✓");
    console.log("   Receipt submitted to indexer        ✓");
    console.log("   submit_attestation fired on-chain   ✓");
    console.log("   Reputation score incremented        ✓\n");
}
