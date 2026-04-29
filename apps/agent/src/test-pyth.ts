import "dotenv/config";
/**
 * Dolores PumpFun Pyth Test Harness
 *
 * Run: npm run test:pyth '<natural language command>'
 *
 * Examples:
 *   npm run test:pyth 'get price of SOL'
 *   npm run test:pyth 'check BTC and ETH prices'
 *   npm run test:pyth 'list supported assets'
 */

import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
    parsePythCommand,
    executePythDecision,
    printPriceResults,
    formatPriceUSD,
} from "./pyth/execute-pyth";

// ============================================================================
// Agent keypair loading (matches existing dolores-agent pattern)
// ============================================================================

function loadAgentKeypair(): Keypair {
    const candidates = [
        process.env.AGENT_KEYPAIR_PATH,
        path.join(os.homedir(), ".config", "solana", "dolores-agent.json"),
        path.join(os.homedir(), ".config", "solana", "id.json"),
    ].filter(Boolean) as string[];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
            return Keypair.fromSecretKey(Uint8Array.from(raw));
        }
    }

    throw new Error(
        "No agent keypair found. Set AGENT_KEYPAIR_PATH or place keypair at ~/.config/solana/dolores-agent.json"
    );
}

// ============================================================================
// Receipt signing
// ============================================================================

function signOutput(payload: object, keypair: Keypair): {
    outputHash: string;
    agentSignature: string;
} {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto.createHash("sha256").update(canonical).digest();
    const outputHash = hash.toString("hex");

    const sig = nacl.sign.detached(hash, keypair.secretKey);
    const agentSignature = Buffer.from(sig).toString("hex");

    return { outputHash, agentSignature };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const command = process.argv.slice(2).join(" ");
    if (!command) {
        console.error("Usage: npm run test:pyth '<command>'");
        console.error("Examples:");
        console.error("  npm run test:pyth 'get price of SOL'");
        console.error("  npm run test:pyth 'check BTC and ETH prices'");
        console.error("  npm run test:pyth 'list supported assets'");
        process.exit(1);
    }

    console.log("🚀 Dolores Pyth Agent");

    const keypair = loadAgentKeypair();
    const agentPubkey = keypair.publicKey.toBase58();
    console.log(`Agent    : ${agentPubkey}`);
    console.log(`Command  : ${command}`);

    // Step 1: Parse with Claude Haiku
    console.log("🤖 Asking Claude...");
    const decision = await parsePythCommand(command);
    console.log("Decision :", JSON.stringify(decision, null, 2));

    if (decision.action === "reject") {
        console.log(`⚠️  Rejected: ${decision.reason}`);
        process.exit(0);
    }

    // Step 2: Execute via Hermes
    console.log("📡 Fetching from Pyth Hermes...");
    const result = await executePythDecision(decision);

    // Step 3: Display results
    if (result.action === "list") {
        console.log(`\n✅ Supported symbols (${result.supportedSymbols!.length}):`);
        const cols = 6;
        const symbols = result.supportedSymbols!;
        for (let i = 0; i < symbols.length; i += cols) {
            console.log(
                "  " + symbols.slice(i, i + cols).map((s) => s.padEnd(8)).join("")
            );
        }
        console.log("");
    } else if (result.action === "price" && result.prices) {
        console.log(`\n✅ Fetched ${result.prices.length} price(s) from Pyth`);
        printPriceResults(result.prices);

        // Detail view for each
        for (const p of result.prices) {
            console.log(`📊 ${p.symbol}/USD`);
            console.log(`   Price       : ${formatPriceUSD(p.price)}`);
            console.log(`   Confidence  : ±${formatPriceUSD(p.confidence)} (${p.confidencePercent.toFixed(3)}%)`);
            if (p.emaPrice !== undefined) {
                console.log(`   EMA Price   : ${formatPriceUSD(p.emaPrice)}`);
            }
            console.log(`   Age         : ${p.ageSeconds}s`);
            console.log(`   Feed ID     : ${p.feedId.slice(0, 18)}...`);
            console.log("");
        }
    } else if (result.action === "reject") {
        console.log(`⚠️  Execution rejected: ${result.reason}`);
        process.exit(0);
    }

    // Step 4: Sign the receipt with the agent's keypair
    const receiptPayload = {
        agent: agentPubkey,
        command,
        decision,
        result,
        timestamp: result.timestamp,
    };

    const { outputHash, agentSignature } = signOutput(receiptPayload, keypair);

    console.log(`📝 Output hash : ${outputHash}`);
    console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
    console.log("✅ Full loop complete!");
    console.log("   Claude parsed instruction       ✓");
    console.log("   Pyth Hermes price fetched       ✓");
    console.log("   output_hash signed by agent     ✓");
}

main().catch((err) => {
    console.error("❌ Error:", err.message ?? err);
    process.exit(1);
});