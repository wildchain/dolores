import fetch from "node-fetch";

export async function historyCommand(opts: {
  agentId: string;
  indexerUrl: string;
}) {
  console.log(`\nFetching reputation for ${opts.agentId}...\n`);

  try {
    const res = await fetch(`${opts.indexerUrl}/agents/${opts.agentId}`);

    if (res.status === 404) {
      console.error(`Agent ${opts.agentId} not found — not registered on-chain.`);
      process.exit(1);
    }

    if (!res.ok) {
      console.error(`Error: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const data = await res.json() as any;

    console.log(`Agent           : ${data.agentId}`);
    console.log(`Operator        : ${data.operator}`);
    console.log(`Registry PDA    : ${data.registryPda}`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Reputation      : ${data.reputationScore} / 10000`);
    console.log(`Slash count     : ${data.slashCount}`);
    console.log(`Declared stake  : ${data.declaredStake} lamports`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Registered      : ${data.registeredAt}`);
    console.log(`Last attested   : ${data.lastAttestedAt ?? "never"}`);
    console.log(`Arweave history : ${data.arweaveCid ?? "none (no slash events yet)"}`);
    console.log();

    const score = data.reputationScore;
    if (data.slashCount >= 3) {
      console.log(`Status :  Banned (3+ slashes)`);
    } else if (score >= 5000) {
      console.log(`Status :  Trusted (reputation ≥ 5000)`);
    } else if (score >= 1000) {
      console.log(`Status :  Building reputation`);
    } else {
      console.log(`Status :  Low reputation — needs more attestations`);
    }

    console.log();
  } catch (err: any) {
    console.error(`Failed to reach indexer at ${opts.indexerUrl}`);
    console.error(`Make sure the indexer is running: npm run start:dev`);
    console.error(err?.message);
    process.exit(1);
  }
}
