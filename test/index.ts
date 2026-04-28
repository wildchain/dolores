import { Program, AnchorProvider } from "@coral-xyz/anchor";

const program = new Program(idlRegistry, provider);

// Fetch all AgentRegistered events from transaction
const tx = await connection.getTransaction("<TX_SIGNATURE>", {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
});

const events = program.coder.events.decode(
    tx?.meta?.logMessages ?? []
);

console.log(events);