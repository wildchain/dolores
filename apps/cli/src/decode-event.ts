import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import idlRegistry from "./idl/dolores_registry.json";

const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
const TX_SIGNATURE = process.argv[2];

if (!TX_SIGNATURE) {
    console.error("Usage: npx ts-node src/decode-event.ts <TX_SIGNATURE>");
    process.exit(1);
}

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    const tx = await connection.getTransaction(TX_SIGNATURE, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
        console.error("Transaction not found");
        process.exit(1);
    }

    const coder = new BorshCoder(idlRegistry as any);
    const parser = new EventParser(new PublicKey(REGISTRY_PROGRAM_ID), coder);
    const logs = tx.meta?.logMessages ?? [];
    const events = [...parser.parseLogs(logs)];

    if (events.length === 0) {
        console.log("No events found in this transaction");
    } else {
        events.forEach(e => {
            console.log(`\nEvent: ${e.name}`);
            console.log(JSON.stringify(e.data, null, 2));
        });
    }
}

main().catch(console.error);