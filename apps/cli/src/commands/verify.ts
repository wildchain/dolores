import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import fetch from "node-fetch";
import { doloresRegistryIdl, PROGRAM_IDS } from "@dolores/contracts";

const idlRegistry = doloresRegistryIdl;

const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
const REGISTRY_SEED = Buffer.from("registry");

export async function verifyCommand(opts: {
  agentId: string;
  minReputation: number;
  minStakeSol: number;
  indexerUrl: string;
  rpcUrl: string;
}) {
  console.log("\n🔍 Dolores — Verify Agent\n");
  console.log(`Agent           : ${opts.agentId}`);
  console.log(`Min reputation  : ${opts.minReputation} / 10000`);
  console.log(`Min stake       : ${opts.minStakeSol} SOL\n`);

  // 1. Fetch live on-chain data via indexer
  let onChain: any;
  try {
    const res = await fetch(`${opts.indexerUrl}/agents/${opts.agentId}`);
    if (!res.ok) {
      console.error(`❌ Agent not found — not registered on-chain`);
      process.exit(1);
    }
    onChain = await res.json();
  } catch {
    console.error(`❌ Could not reach indexer at ${opts.indexerUrl}`);
    console.error(`   Make sure the indexer is running: npm run start:dev`);
    process.exit(1);
  }

  const reputation = onChain.reputationScore as number;
  const slashCount = onChain.slashCount as number;
  const declaredStake = Number(onChain.declaredStake);
  const minStakeLamports = Math.floor(opts.minStakeSol * LAMPORTS_PER_SOL);

  // 2. Evaluate each condition
  const meetsReputation = reputation >= opts.minReputation;
  const meetsStake = declaredStake >= minStakeLamports;
  const notBanned = slashCount < 3;
  const trusted = meetsReputation && meetsStake && notBanned;

  // 3. Print result
  console.log(`─────────────────────────────────────────`);
  console.log(
    `Reputation      : ${reputation} / 10000  ${meetsReputation ? "✅" : "❌"}  (min: ${opts.minReputation})`,
  );
  console.log(
    `Declared stake  : ${(declaredStake / LAMPORTS_PER_SOL).toFixed(4)} SOL  ${meetsStake ? "✅" : "❌"}  (min: ${opts.minStakeSol} SOL)`,
  );
  console.log(
    `Slash count     : ${slashCount}  ${notBanned ? "✅" : "❌"}  (max: 2)`,
  );
  console.log(`─────────────────────────────────────────`);

  if (trusted) {
    console.log(`\nVerdict         :  TRUSTED\n`);
    console.log(`This agent meets all minimum thresholds.`);
    console.log(`A DeFi protocol calling verify_agent() would grant access.\n`);
  } else {
    console.log(`\nVerdict         :  NOT TRUSTED\n`);
    if (!meetsReputation) {
      const needed = opts.minReputation - reputation;
      const tasksNeeded = Math.ceil(needed / 42);
      console.log(
        `   Reputation too low — needs ${needed} more points (~${tasksNeeded} more tasks)`,
      );
    }
    if (!meetsStake) {
      const neededSol = (
        (minStakeLamports - declaredStake) /
        LAMPORTS_PER_SOL
      ).toFixed(4);
      console.log(`   Stake too low — stake ${neededSol} more SOL`);
      console.log(
        `   Run: dolores stake --agent-id ${opts.agentId} --amount ${neededSol}`,
      );
    }
    if (!notBanned) {
      console.log(`   Agent is banned — 3+ slashes on record`);
    }
    console.log();
  }
}
