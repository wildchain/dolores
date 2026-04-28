import fetch from "node-fetch";

const STATUS_EMOJI: Record<string, string> = {
    pending: "⏳",
    completed: "✅",
    challenged: "⚖️",
    slashed: "🔴",
    dismissed: "⚪",
};

export async function taskStatusCommand(opts: {
    taskId: string;
    indexerUrl: string;
}) {
    console.log(`\n Dolores — Task Status\n`);
    console.log(`Task ID : ${opts.taskId}\n`);

    let task: any;
    try {
        const res = await fetch(`${opts.indexerUrl}/tasks/${opts.taskId}`);

        if (res.status === 404) {
            console.error(` Task not found in indexer.`);
            console.error(`   It may not have been picked up yet — wait a few seconds and retry.`);
            process.exit(1);
        }

        if (!res.ok) {
            console.error(` Indexer error ${res.status}: ${await res.text()}`);
            process.exit(1);
        }

        task = await res.json();
    } catch {
        console.error(`Could not reach indexer at ${opts.indexerUrl}`);
        process.exit(1);
    }

    const emoji = STATUS_EMOJI[task.status] ?? "❓";
    const deadline = new Date(task.deadline * 1000).toISOString();
    const created = new Date(task.onChainCreatedAt * 1000).toISOString();
    const completed = task.completedAt
        ? new Date(task.completedAt * 1000).toISOString()
        : null;

    console.log(`─────────────────────────────────────────`);
    console.log(`Status      : ${emoji}  ${task.status.toUpperCase()}`);
    console.log(`Agent       : ${task.agentId}`);
    console.log(`Assigned by : ${task.assignedBy}`);
    console.log(`Instruction : ${task.instruction}`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Created     : ${created}`);
    console.log(`Deadline    : ${deadline}`);

    if (completed) {
        console.log(`Completed   : ${completed}`);
    }

    if (task.outputHash) {
        console.log(`Output hash : ${task.outputHash}`);
    }

    if (task.attestationTx) {
        console.log(`Attestation : ${task.attestationTx}`);
        console.log(`Explorer    : https://explorer.solana.com/tx/${task.attestationTx}?cluster=devnet`);
    }

    if (task.arweaveCid) {
        console.log(`Arweave     : https://arweave.net/${task.arweaveCid}`);
    }

    console.log(`─────────────────────────────────────────`);

    //  Contextual next steps 
    if (task.status === "pending") {
        const nowUnix = Math.floor(Date.now() / 1000);
        const remaining = task.deadline - nowUnix;
        if (remaining > 0) {
            console.log(`\n Agent has ${Math.floor(remaining / 60)}m ${remaining % 60}s to complete this task.`);
        } else {
            console.log(`\n  Deadline passed — task is eligible for a missed-deadline challenge.`);
            console.log(`   dolores challenge --agent-id ${task.agentId} --type missed-deadline`);
        }
    }

    if (task.status === "completed") {
        console.log(`\n Task completed successfully.`);
        console.log(`   To verify the receipt independently:`);
        console.log(`   1. Fetch receipt from Arweave: arweave.net/${task.arweaveCid ?? "<cid>"}`);
        console.log(`   2. sha256(receipt_json) should equal: ${task.outputHash ?? "<output_hash>"}`);
    }

    if (task.status === "slashed") {
        console.log(`\n Agent was slashed for this task.`);
        console.log(`   Check agent reputation: dolores history --agent-id ${task.agentId}`);
    }

    console.log();
}