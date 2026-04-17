#!/usr/bin/env node
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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const register_1 = require("./commands/register");
const history_1 = require("./commands/history");
const run_1 = require("./commands/run");
const DEFAULT_OPERATOR_KEY = path.join(os.homedir(), ".config", "solana", "id.json");
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd";
const DEFAULT_INDEXER_URL = "http://localhost:8080";
const program = new commander_1.Command();
program
    .name("dolores")
    .description("Dolores Protocol CLI")
    .version("0.1.0");
// ─── register ─────────────────────────────────────────────────
program
    .command("register")
    .description("Generate an agent keypair and register it on-chain")
    .option("--operator-key <path>", "Path to operator wallet keypair JSON", DEFAULT_OPERATOR_KEY)
    .option("--program-id <pubkey>", "Dolores registry program ID", DEFAULT_PROGRAM_ID)
    .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
    .action(async (opts) => {
    await (0, register_1.registerCommand)({
        operatorKeyPath: opts.operatorKey,
        programId: opts.programId,
        rpcUrl: opts.rpc,
    });
});
// ─── history ──────────────────────────────────────────────────
program
    .command("history")
    .description("Fetch on-chain reputation history for an agent")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
    .action(async (opts) => {
    await (0, history_1.historyCommand)({
        agentId: opts.agentId,
        indexerUrl: opts.indexer,
    });
});
// ─── run ──────────────────────────────────────────────────────
program
    .command("run")
    .description("Run an agent task — transfers devnet SOL and submits attestation on-chain")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--recipient <pubkey>", "Recipient wallet (default: random keypair)")
    .option("--amount <sol>", "SOL amount to transfer", "0.001")
    .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
    .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
    .action(async (opts) => {
    await (0, run_1.runCommand)({
        agentId: opts.agentId,
        recipient: opts.recipient,
        amountSol: parseFloat(opts.amount),
        indexerUrl: opts.indexer,
        rpcUrl: opts.rpc,
    });
});
// ─── stake (stub — needs dolores_fund) ────────────────────────
program
    .command("stake")
    .description("Stake USDC for an agent (requires dolores_fund program)")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .requiredOption("--amount <usdc>", "Amount of USDC to stake")
    .action((opts) => {
    console.log(`\n⚠️  dolores stake is not available yet.`);
    console.log(`   dolores_fund is the next program being built.\n`);
    console.log(`   When ready, this will lock ${opts.amount} USDC into the`);
    console.log(`   FundAccount PDA and update declared_stake on the registry`);
    console.log(`   so verify_agent() passes minimum stake checks.\n`);
});
// ─── verify (stub — needs dolores_fund) ───────────────────────
program
    .command("verify")
    .description("Verify an agent meets minimum reputation and stake thresholds")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--min-rep <score>", "Minimum reputation score", "5000")
    .option("--min-stake <usdc>", "Minimum stake in USDC", "100")
    .action((opts) => {
    console.log(`\n⚠️  dolores verify stake check requires dolores_fund.\n`);
    console.log(`   Check reputation now via:`);
    console.log(`   curl ${DEFAULT_INDEXER_URL}/agents/${opts.agentId}\n`);
});
// ─── challenge (stub — needs dolores_adjudication) ────────────
program
    .command("challenge")
    .description("File a challenge against an agent for a failed task")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .requiredOption("--task-id <id>", "Task ID to challenge")
    .requiredOption("--type <type>", "Failure type: missed-deadline | out-of-scope-call")
    .action((opts) => {
    console.log(`\n⚠️  dolores challenge requires dolores_adjudication program.\n`);
    console.log(`   Agent : ${opts.agentId}`);
    console.log(`   Task  : ${opts.taskId}`);
    console.log(`   Type  : ${opts.type}\n`);
});
program.parse(process.argv);
