#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { registerCommand } from "./commands/register";
import { historyCommand } from "./commands/history";
import { runCommand } from "./commands/run";
import { stakeCommand } from "./commands/stake";
import { verifyCommand } from "./commands/verify";
import { challengeCommand } from "./commands/challenge";
import { assignCommand } from "./commands/assign";
import { taskStatusCommand } from "./commands/task-status";

const DEFAULT_OPERATOR_KEY = path.join(
  os.homedir(),
  ".config",
  "solana",
  "id.json",
);
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd";
const DEFAULT_INDEXER_URL = "http://localhost:8545";

const program = new Command();

program.name("dolores").description("Dolores Protocol CLI").version("0.1.0");

//  register

program
  .command("register")
  .description("Generate an agent keypair and register it on-chain")
  .option(
    "--operator-key <path>",
    "Path to operator wallet keypair JSON",
    DEFAULT_OPERATOR_KEY,
  )
  .option(
    "--program-id <pubkey>",
    "Dolores registry program ID",
    DEFAULT_PROGRAM_ID,
  )
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .action(async opts => {
    await registerCommand({
      operatorKeyPath: opts.operatorKey,
      programId: opts.programId,
      rpcUrl: opts.rpc,
    });
  });

//  history

program
  .command("history")
  .description("Fetch on-chain reputation history for an agent")
  .requiredOption("--agent-id <pubkey>", "Agent public key")
  .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
  .action(async opts => {
    await historyCommand({
      agentId: opts.agentId,
      indexerUrl: opts.indexer,
    });
  });

//  run

program
  .command("run")
  .description(
    "Run an agent task — transfers devnet SOL and submits attestation on-chain",
  )
  .requiredOption("--agent-id <pubkey>", "Agent public key")
  .option("--recipient <pubkey>", "Recipient wallet (default: random keypair)")
  .option("--amount <sol>", "SOL amount to transfer", "0.001")
  .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .action(async opts => {
    await runCommand({
      agentId: opts.agentId,
      recipient: opts.recipient,
      amountSol: parseFloat(opts.amount),
      indexerUrl: opts.indexer,
      rpcUrl: opts.rpc,
    });
  });

//  stake

program
  .command("stake")
  .description("Stake SOL for an agent into the FundAccount vault")
  .requiredOption("--agent-id <pubkey>", "Agent public key")
  .requiredOption("--amount <sol>", "Amount of SOL to stake")
  .option(
    "--operator-key <path>",
    "Path to operator wallet keypair JSON",
    DEFAULT_OPERATOR_KEY,
  )
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .action(async opts => {
    await stakeCommand({
      agentId: opts.agentId,
      amountSol: parseFloat(opts.amount),
      operatorKeyPath: opts.operatorKey,
      rpcUrl: opts.rpc,
    });
  });

//  verify

program
  .command("verify")
  .description("Verify an agent meets minimum reputation and stake thresholds")
  .requiredOption("--agent-id <pubkey>", "Agent public key")
  .option("--min-rep <score>", "Minimum reputation score (0–10000)", "100")
  .option("--min-stake <sol>", "Minimum stake in SOL", "0.1")
  .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .action(async opts => {
    await verifyCommand({
      agentId: opts.agentId,
      minReputation: parseInt(opts.minRep),
      minStakeSol: parseFloat(opts.minStake),
      indexerUrl: opts.indexer,
      rpcUrl: opts.rpc,
    });
  });

//  challenge

program
  .command("challenge")
  .description(
    "Register a task, file a challenge, and auto-adjudicate on-chain",
  )
  .requiredOption("--agent-id <pubkey>", "Agent public key to challenge")
  .requiredOption(
    "--type <type>",
    "Failure type: missed-deadline | out-of-scope-call",
  )
  .option(
    "--operator-key <path>",
    "Path to operator wallet keypair JSON",
    DEFAULT_OPERATOR_KEY,
  )
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .action(async opts => {
    await challengeCommand({
      agentId: opts.agentId,
      failureType: opts.type,
      operatorKeyPath: opts.operatorKey,
      rpcUrl: opts.rpc,
    });
  });

//  assign

program
  .command("assign")
  .description(
    "Assign a task to an agent — registers instruction on-chain and notifies indexer",
  )
  .requiredOption("--agent-id <pubkey>", "Agent public key to assign task to")
  .requiredOption(
    "--instruction <text>",
    "Natural language instruction for the agent (max 256 chars)",
  )
  .option("--deadline <minutes>", "Minutes from now until deadline", "60")
  .option(
    "--operator-key <path>",
    "Path to operator wallet keypair JSON",
    DEFAULT_OPERATOR_KEY,
  )
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
  .action(async opts => {
    await assignCommand({
      agentId: opts.agentId,
      instruction: opts.instruction,
      deadlineMinutes: parseInt(opts.deadline),
      operatorKeyPath: opts.operatorKey,
      rpcUrl: opts.rpc,
      indexerUrl: opts.indexer,
    });
  });

//  task-status

program
  .command("task-status")
  .description("Check the status of a task by its on-chain task ID")
  .requiredOption(
    "--task-id <hex>",
    "Task ID (hex string from dolores assign output)",
  )
  .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER_URL)
  .action(async opts => {
    await taskStatusCommand({
      taskId: opts.taskId,
      indexerUrl: opts.indexer,
    });
  });

program.parse(process.argv);
