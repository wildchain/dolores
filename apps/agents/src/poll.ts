import fetch from "node-fetch";

export interface PendingTask {
    taskId: string;
    agentId: string;
    assignedBy: string;
    instruction: string;
    deadline: number;
    onChainCreatedAt: number;
    status: string;
}

export async function fetchPendingTasks(
    indexerUrl: string,
    agentId: string
): Promise<PendingTask[]> {
    const res = await fetch(`${indexerUrl}/tasks/agent/${agentId}/pending`);

    // 404 means no pending tasks — not an error
    if (res.status === 404) return [];

    if (!res.ok) {
        throw new Error(`Indexer poll failed ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export function startPolling(
    indexerUrl: string,
    agentId: string,
    intervalMs: number,
    onTasks: (tasks: PendingTask[]) => Promise<void>
): () => void {
    let running = true;
    let processing = false;

    const tick = async () => {
        if (!running) return;

        // Skip tick if previous execution is still running
        // Prevents overlapping executions of the same task
        if (processing) return;

        try {
            const tasks = await fetchPendingTasks(indexerUrl, agentId);
            if (tasks.length > 0) {
                processing = true;
                await onTasks(tasks);
                processing = false;
            }
        } catch (err: any) {
            processing = false;
            console.error(`[poll] Error fetching tasks: ${err?.message}`);
        }
    };

    const interval = setInterval(tick, intervalMs);

    // Return a stop function
    return () => {
        running = false;
        clearInterval(interval);
    };
}