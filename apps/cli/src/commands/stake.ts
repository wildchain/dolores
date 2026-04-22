import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  doloresRegistryIdl,
  doloresFundIdl,
  PROGRAM_IDS,
} from "@dolores/contracts";

const idlRegistry = doloresRegistryIdl;
const idlFund = doloresFundIdl;

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";

const REGISTRY_SEED = Buffer.from("registry");
const FUND_SEED = Buffer.from("fund");
const VAULT_SEED = Buffer.from("vault");
const STAKER_SEED = Buffer.from("staker");

function loadKeypairFromFile(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export async function stakeCommand(opts: {
  agentId: string;
  amountSol: number;
  operatorKeyPath: string;
  rpcUrl: string;
}) {
  console.log("\n💰 Dolores — Stake SOL\n");

  // 1. Load operator wallet
  const operatorKeypair = loadKeypairFromFile(opts.operatorKeyPath);
  console.log(`Operator        : ${operatorKeypair.publicKey.toBase58()}`);
  console.log(`Agent           : ${opts.agentId}`);
  console.log(`Amount          : ${opts.amountSol} SOL\n`);

  const agentPubkey = new PublicKey(opts.agentId);
  const amountLamports = Math.floor(opts.amountSol * LAMPORTS_PER_SOL);

  // 2. Check operator balance
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const balance = await connection.getBalance(operatorKeypair.publicKey);
  console.log(
    `Operator balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
  );

  if (balance < amountLamports + 10_000_000) {
    console.error(`\n Insufficient balance.`);
    console.error(`   Need ${opts.amountSol} SOL + ~0.01 SOL for fees`);
    console.error(`   Fund your wallet at https://faucet.solana.com`);
    process.exit(1);
  }

  // 3. Derive PDAs
  const registryProgId = new PublicKey(REGISTRY_PROGRAM_ID);
  const fundProgId = new PublicKey(FUND_PROGRAM_ID);

  const [registryPda] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED, agentPubkey.toBuffer()],
    registryProgId,
  );
  const [fundPda] = PublicKey.findProgramAddressSync(
    [FUND_SEED, operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()],
    fundProgId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()],
    fundProgId,
  );
  const [stakerPositionPda] = PublicKey.findProgramAddressSync(
    [STAKER_SEED, fundPda.toBuffer(), operatorKeypair.publicKey.toBuffer()],
    fundProgId,
  );

  console.log(`Fund PDA        : ${fundPda.toBase58()}`);
  console.log(`Vault PDA       : ${vaultPda.toBase58()}\n`);

  // 4. Setup programs
  const wallet = new Wallet(operatorKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const registryProgram = new Program(idlRegistry as any, provider) as any;
  const fundProgram = new Program(idlFund as any, provider) as any;

  // 5. Verify fund exists
  try {
    await fundProgram.account.fundAccount.fetch(fundPda);
  } catch {
    console.error(` Fund not initialized for this agent.`);
    console.error(`   Run: dolores register --agent-id ${opts.agentId}`);
    process.exit(1);
  }

  // 6. Step 1 — stake() on dolores_fund
  console.log(`Step 1/2 — Staking ${opts.amountSol} SOL into vault...`);
  try {
    const tx1 = await fundProgram.methods
      .stake(new (require("@coral-xyz/anchor").BN)(amountLamports))
      .accounts({
        operator: operatorKeypair.publicKey,
        fund: fundPda,
        vault: vaultPda,
        stakerPosition: stakerPositionPda,
        systemProgram: "11111111111111111111111111111111",
      })
      .rpc();

    console.log(`✅ SOL staked into vault`);
    console.log(`Transaction     : ${tx1}`);
    console.log(
      `Explorer        : https://explorer.solana.com/tx/${tx1}?cluster=devnet\n`,
    );
  } catch (err: any) {
    console.error(`\n❌ Stake failed: ${err?.message ?? err}`);
    process.exit(1);
  }

  // 7. Step 2 — update_declared_stake() on dolores_registry
  //    So verify_agent() knows how much is staked without a CPI into dolores_fund
  console.log(`Step 2/2 — Updating declared stake on registry...`);
  try {
    const tx2 = await registryProgram.methods
      .updateDeclaredStake(
        new (require("@coral-xyz/anchor").BN)(amountLamports),
      )
      .accounts({
        operator: operatorKeypair.publicKey,
        registry: registryPda,
      })
      .rpc();

    console.log(` Declared stake updated on registry`);
    console.log(`Transaction     : ${tx2}`);
    console.log(
      `Explorer        : https://explorer.solana.com/tx/${tx2}?cluster=devnet\n`,
    );
  } catch (err: any) {
    console.error(`\n Registry update failed: ${err?.message ?? err}`);
    console.error(`SOL is staked in vault but registry not updated.`);
    process.exit(1);
  }

  try {
    const fund = await fundProgram.account.fundAccount.fetch(fundPda);
    const totalLocked = Number(fund.totalLockedStake) / LAMPORTS_PER_SOL;

    console.log(` Stake complete!\n`);
    console.log(`Agent           : ${opts.agentId}`);
    console.log(`Amount staked   : ${opts.amountSol} SOL`);
    console.log(`Total locked    : ${totalLocked.toFixed(4)} SOL`);
    console.log(
      `\nNext step       : dolores verify --agent-id ${opts.agentId}`,
    );
  } catch {
    console.log(`Stake complete!`);
  }
}
