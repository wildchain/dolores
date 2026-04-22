import {
  Keypair,
  Connection,
  PublicKey,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import idlAdjudication from "../idl/dolores_adjudication.json";

//  Constants 

const ADJ_PROGRAM_ID = "4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz";
const TASK_SEED      = Buffer.from("task");

//  Helpers 

function loadKeypairFromFile(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

//  Command 

export async function assignCommand(opts: {
  agentId: string;
  instruction: string;
  deadlineMinutes: number;
  operatorKeyPath: string;
  rpcUrl: string;
  indexerUrl: string;
}) {
  console.log("\n📋 Dolores — Assign Task\n");

  //  Validate instruction length (matches on-chain MAX_INSTRUCTION_LEN) 
  if (opts.instruction.length > 256) {
    console.error(` Instruction too long: ${opts.instruction.length} chars (max 256)`);
    process.exit(1);
  }

  const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
  const agentPubkey     = new PublicKey(opts.agentId);

  //  Derive deadline 
  const now      = Math.floor(Date.now() / 1000);
  const deadline = now + opts.deadlineMinutes * 60;

  //  Generate task_id 
  // 32 random bytes — unique identifier for this task
  const taskId = crypto.randomBytes(32);

  //  Derive task PDA 
  const adjProgId = new PublicKey(ADJ_PROGRAM_ID);
  const [taskPda] = PublicKey.findProgramAddressSync(
    [TASK_SEED, agentPubkey.toBuffer(), taskId],
    adjProgId
  );

  console.log(`Operator    : ${operatorKeypair.publicKey.toBase58()}`);
  console.log(`Agent       : ${opts.agentId}`);
  console.log(`Instruction : ${opts.instruction}`);
  console.log(`Deadline    : ${new Date(deadline * 1000).toISOString()} (+${opts.deadlineMinutes}m)`);
  console.log(`Task ID     : ${taskId.toString("hex").slice(0, 16)}...`);
  console.log(`Task PDA    : ${taskPda.toBase58()}\n`);

  //  Setup provider 
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const wallet     = new Wallet(operatorKeypair);
  const provider   = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const adjProgram = new Program(idlAdjudication as any, provider);

  //  register_task() on-chain 
  console.log("Registering task on-chain...");
  try {
    const tx = await (adjProgram.methods as any)
      .registerTask(
        Array.from(taskId),
        new BN(deadline),
        opts.instruction,
      )
      .accounts({
        user:         operatorKeypair.publicKey,
        agent:        agentPubkey,
        taskRecord:   taskPda,
        systemProgram: "11111111111111111111111111111111",
      })
      .rpc();

    console.log(` Task registered on-chain`);
    console.log(`Transaction : ${tx}`);
    console.log(`Explorer    : https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (err: any) {
    console.error(` register_task failed: ${err?.message ?? err}`);
    process.exit(1);
  }

  //  POST to indexer so agent polling loop picks it up immediately 
  console.log("Notifying indexer...");
  try {
    const res = await fetch(`${opts.indexerUrl}/tasks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId:          taskId.toString("hex"),
        agentId:         opts.agentId,
        assignedBy:      operatorKeypair.publicKey.toBase58(),
        instruction:     opts.instruction,
        deadline,
        onChainCreatedAt: now,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`  Indexer notification failed (${res.status}): ${text}`);
      console.warn(`   Agent will still pick up the task on next poll via on-chain event`);
    } else {
      console.log(` Indexer notified — agent will pick up task within ${Math.ceil(3000 / 1000)}s\n`);
    }
  } catch {
    console.warn(`  Could not reach indexer at ${opts.indexerUrl}`);
    console.warn(`   Agent will pick up the task on next poll\n`);
  }

  
  console.log(`Task assigned!\n`);
  console.log(`  Task ID     : ${taskId.toString("hex")}`);
  console.log(`  Agent       : ${opts.agentId}`);
  console.log(`  Instruction : ${opts.instruction}`);
  console.log(`  Deadline    : ${new Date(deadline * 1000).toISOString()}`);
  console.log(`\nNext steps:`);
  console.log(`  Monitor     : dolores task-status --task-id ${taskId.toString("hex")}`);
  console.log(`  Challenge   : dolores challenge --agent-id ${opts.agentId} --type missed-deadline\n`);
}