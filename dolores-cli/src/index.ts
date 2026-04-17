#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { registerCommand } from "./commands/register";
import { historyCommand } from "./commands/history";
import { runCommand } from "./commands/run";

const DEFAULT_OPERATOR_KEY = path.join(os.homedir(), ".config", "solana", "id.json");
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd";
const DEFAULT_INDEXER_URL = "http://localhost:8080";

const program = new Command();

program
    .name("dolores")
    .description("Dolores Protocol CLI")
    .version("0.1.0");

//  register 

program
    .command("register")
    .description("Generate an agent keypair and register it on-chain")
    .option("--operator-key <path>", "Path to operator wallet keypair JSON", DEFAULT_OPERATOR_KEY)
    .option("--program-id <pubkey>", "Dolores registry program ID", DEFAULT_PROGRAM_ID)
    .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
    .action(async (opts) => {
        await registerCommand({
            operatorKeyPath: opts.operatorKey,
            programId: opts.programId,
            rpcUrl: opts.rpc,
        });
    });

// history 

program
    .command("history")
    .description("Fetch on-chain reputation history for an agent")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
    .action(async (opts) => {
        await historyCommand({
            agentId: opts.agentId,
            indexerUrl: opts.indexer,
        });
    });

//  run 

program
    .command("run")
    .description("Run an agent task — transfers devnet SOL and submits attestation on-chain")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--recipient <pubkey>", "Recipient wallet (default: random keypair)")
    .option("--amount <sol>", "SOL amount to transfer", "0.001")
    .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
    .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
    .action(async (opts) => {
        await runCommand({
            agentId: opts.agentId,
            recipient: opts.recipient,
            amountSol: parseFloat(opts.amount),
            indexerUrl: opts.indexer,
            rpcUrl: opts.rpc,
        });
    });

//  stake (stub - needs dolores_fund) 

program
    .command("stake")
    .description("Stake USDC for an agent (requires dolores_fund program)")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .requiredOption("--amount <usdc>", "Amount of USDC to stake")
    .action((opts) => {
        console.log(`\n  dolores stake is not available yet.`);
        console.log(`   dolores_fund is the next program being built.\n`);
        console.log(`   When ready, this will lock ${opts.amount} USDC into the`);
        console.log(`   FundAccount PDA and update declared_stake on the registry`);
        console.log(`   so verify_agent() passes minimum stake checks.\n`);
    });

//  verify (stub — needs dolores_fund) 

program
    .command("verify")
    .description("Verify an agent meets minimum reputation and stake thresholds")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .option("--min-rep <score>", "Minimum reputation score", "5000")
    .option("--min-stake <usdc>", "Minimum stake in USDC", "100")
    .action((opts) => {
        console.log(`\n  dolores verify stake check requires dolores_fund.\n`);
        console.log(`   Check reputation now via:`);
        console.log(`   curl ${DEFAULT_INDEXER_URL}/agents/${opts.agentId}\n`);
    });

//  challenge (stub — needs dolores_adjudication) 

program
    .command("challenge")
    .description("File a challenge against an agent for a failed task")
    .requiredOption("--agent-id <pubkey>", "Agent public key")
    .requiredOption("--task-id <id>", "Task ID to challenge")
    .requiredOption("--type <type>", "Failure type: missed-deadline | out-of-scope-call")
    .action((opts) => {
        console.log(`\n  dolores challenge requires dolores_adjudication program.\n`);
        console.log(`   Agent : ${opts.agentId}`);
        console.log(`   Task  : ${opts.taskId}`);
        console.log(`   Type  : ${opts.type}\n`);
    });

program.parse(process.argv);