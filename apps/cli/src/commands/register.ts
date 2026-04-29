import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idlRegistry from "../idl/dolores_registry.json";
import idlFund from "../idl/dolores_fund.json";
import {
  hashManifest,
  templateChoices,
  templateByIndex,
  CAPABILITY_TEMPLATES,
} from "../templates";

const REGISTRY_SEED = Buffer.from("registry");
const FUND_SEED = Buffer.from("fund");
const VAULT_SEED = Buffer.from("vault");
const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");

const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";

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

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function registerCommand(opts: {
  operatorKeyPath: string;
  programId: string;
  rpcUrl: string;
}) {
  console.log("\n🤖 Dolores — Agent Registration\n");

  // 1. Load operator wallet
  const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
  console.log(`Operator wallet : ${operatorKeypair.publicKey.toBase58()}`);

  // 2. Generate agent keypair
  const agentKeypair = Keypair.generate();
  console.log(`Agent keypair   : ${agentKeypair.publicKey.toBase58()} (new)\n`);

  // 3. Pick capability template
  console.log(
    "Available capability templates (sourced from solana.com/skills):\n",
  );
  console.log(templateChoices());
  console.log();

  const templateInput = await prompt(
    `Select template (1–${Object.keys(CAPABILITY_TEMPLATES).length}): `,
  );
  const selection = templateByIndex(parseInt(templateInput));

  if (!selection) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const [templateKey, manifest] = selection;
  const capabilityHash = await hashManifest(manifest);
  const capabilityHashHex = Buffer.from(capabilityHash).toString("hex");

  console.log(`\nTemplate        : ${templateKey}`);
  console.log(`Skill reference : ${manifest.skill_ref}`);
  console.log(`Allowed programs:`);
  manifest.allowed_programs.forEach(p => console.log(`  ${p}`));
  console.log(
    `Max transfer    : ${manifest.global_constraints.max_single_transaction_usdc.toLocaleString()} USDC`,
  );
  console.log(`Capability hash : ${capabilityHashHex}`);

  // 4. Confirm
  const confirm = await prompt("\nRegister this agent on-chain? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  // 5. Save keypair and manifest
  const savedPath = saveKeypair(agentKeypair);
  console.log(`\nAgent keypair saved → ${savedPath}`);
  console.log("Keep this file safe — it's the agent's signing identity.\n");

  const manifestPath = path.join(
    DOLORES_DIR,
    `${agentKeypair.publicKey.toBase58()}.manifest.json`,
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest saved  → ${manifestPath}\n`);

  // 6. Setup provider
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const wallet = new Wallet(operatorKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const registryProgId = new PublicKey(REGISTRY_PROGRAM_ID);
  const fundProgId = new PublicKey(FUND_PROGRAM_ID);

  // 7. Derive PDAs for logging
  const [registryPda] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED, agentKeypair.publicKey.toBuffer()],
    registryProgId,
  );
  const [fundPda] = PublicKey.findProgramAddressSync(
    [
      FUND_SEED,
      operatorKeypair.publicKey.toBuffer(),
      agentKeypair.publicKey.toBuffer(),
    ],
    fundProgId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [
      VAULT_SEED,
      operatorKeypair.publicKey.toBuffer(),
      agentKeypair.publicKey.toBuffer(),
    ],
    fundProgId,
  );

  console.log(`Registry PDA    : ${registryPda.toBase58()}`);
  console.log(`Fund PDA        : ${fundPda.toBase58()}`);
  console.log(`Vault PDA       : ${vaultPda.toBase58()}\n`);

  const registryProgram = new Program(idlRegistry as any, provider) as any;
  const fundProgram = new Program(idlFund as any, provider) as any;

  // 8. Step 1 — register_agent on dolores_registry
  console.log("Step 1/2 — Registering agent on dolores_registry...");
  try {
    const tx1 = await registryProgram.methods
      .registerAgent(capabilityHash)
      .accounts({
        operator: operatorKeypair.publicKey,
        agent: agentKeypair.publicKey,
      })
      .signers([agentKeypair])
      .rpc();

    console.log(` Agent registered`);
    console.log(`Transaction     : ${tx1}`);
    console.log(
      `Explorer        : https://explorer.solana.com/tx/${tx1}?cluster=devnet\n`,
    );
  } catch (err: any) {
    console.error("\n Registration failed:");
    console.error(err?.message ?? err);
    [savedPath, manifestPath].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    process.exit(1);
  }

  // 9. Step 2 — initialize_fund on dolores_fund
  console.log("Step 2/2 — Initializing fund on dolores_fund...");
  try {
    const tx2 = await fundProgram.methods
      .initializeFund()
      .accounts({
        operator: operatorKeypair.publicKey,
        agent: agentKeypair.publicKey,
      })
      .rpc();

    console.log(` Fund initialized`);
    console.log(`Transaction     : ${tx2}`);
    console.log(
      `Explorer        : https://explorer.solana.com/tx/${tx2}?cluster=devnet\n`,
    );
  } catch (err: any) {
    console.error("\n Fund initialization failed:");
    console.error(err?.message ?? err);
    console.log("Agent is registered but fund is not initialized.");
    console.log(
      `Retry manually: dolores fund-init --agent-id ${agentKeypair.publicKey.toBase58()}`,
    );
    // Don't clean up keypair here — agent IS registered on-chain
  }

  // 10. Summary
  console.log(" Agent fully set up!\n");
  console.log(`Agent pubkey    : ${agentKeypair.publicKey.toBase58()}`);
  console.log(`Registry PDA    : ${registryPda.toBase58()}`);
  console.log(`Fund PDA        : ${fundPda.toBase58()}`);
  console.log(`Template        : ${templateKey}`);
  console.log(
    `\nNext step       : dolores stake --agent-id ${agentKeypair.publicKey.toBase58()} --amount 0.5`,
  );
}
