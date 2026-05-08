"use client";
import { useState, useEffect, useMemo } from "react";
import { ChallengeModal } from "@/components/tasks";
import { StatusBadge } from "@/components/ui";
import { useWalletState } from "@/hooks/useWalletState";
import { cn } from "@/lib/data";
import { agentsApi, tasksApi } from "@/lib/api";
import { TaskStatus } from "@dolores/shared";
import type { TaskListItemDto } from "@dolores/shared";
import type { Task } from "@/types";

const TABS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: TaskStatus.PENDING },
  { label: "Completed", value: TaskStatus.COMPLETED },
  { label: "Failed", value: TaskStatus.FAILED },
  { label: "Disputed", value: TaskStatus.DISPUTED },
];

function fmtTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function fmtStake(lamports: number) {
  return `${(lamports / 1e9).toFixed(3)} SOL`;
}

// Adapter so ChallengeModal (which expects Task) still works
function toTask(t: TaskListItemDto): Task {
  return {
    id: t.taskId,
    agentId: t.agentId,
    agentName: t.agentName,
    assignedBy: t.requester,
    description: t.capabilityName,
    status: t.status as any,
    deadline: "—",
    completedAt: t.completedAt ? fmtTime(t.completedAt) : undefined,
    txSignatures: [],
    timestamp: fmtTime(t.createdAt),
  };
}

export default function TasksPage() {
  const { address, connected } = useWalletState();

  const [tab, setTab] = useState<TaskStatus | "all">("all");
  const [tasks, setTasks] = useState<TaskListItemDto[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [challenge, setChallenge] = useState<Task | null>(null);

  async function loadTasksForAgent(id: string) {
    const res = await tasksApi.getTasks({ agentId: id, limit: 100 });
    return res.data as TaskListItemDto[];
  }

  // Auto-load on wallet connect — find agents owned by this operator
  useEffect(() => {
    if (!address) {
      setTasks([]);
      setAgentId(null);
      return;
    }
    setLoading(true);
    agentsApi
      .getAgents({ limit: 100 })
      .then(async res => {
        const mine = res.data.filter(a => a.operator === address);
        if (!mine.length) {
          setLoading(false);
          return;
        }
        const id = mine[0].agentId;
        setAgentId(id);
        setTasks(await loadTasksForAgent(id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Load tasks for a manually entered agent ID
  async function loadAgent(id?: string) {
    const targetId = (id ?? manualInput).trim();
    if (!targetId) return;
    if (agentId) setSwitchLoading(true);
    else setLoading(true);
    try {
      const t = await loadTasksForAgent(targetId);
      setAgentId(targetId);
      setTasks(t);
      setManualInput("");
      setTab("all");
    } catch {
    } finally {
      setLoading(false);
      setSwitchLoading(false);
    }
  }

  // Poll every 5s
  useEffect(() => {
    if (!agentId) return;
    const interval = setInterval(async () => {
      setTasks(await loadTasksForAgent(agentId));
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const filtered = useMemo(
    () => (tab === "all" ? tasks : tasks.filter(t => t.status === tab)),
    [tasks, tab],
  );

  const counts = useMemo(
    () =>
      TABS.reduce(
        (acc, t) => ({
          ...acc,
          [t.value]:
            t.value === "all"
              ? tasks.length
              : tasks.filter(x => x.status === t.value).length,
        }),
        {} as Record<string, number>,
      ),
    [tasks],
  );

  return (
    <div className="px-8 py-8 relative z-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
            Agent Work Queue
          </p>
          <h1
            className="font-display text-4xl font-medium text-moss mb-1.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            Task Panel
          </h1>
          <p className="text-[14px] text-muted">
            Monitor and challenge agent task execution
          </p>
        </div>
        <div className="flex items-center gap-0.5 mt-4 bg-stone border border-jade/25 rounded-sm p-1">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "px-3.5 py-1.5 rounded-sm text-[12px] font-medium transition-all",
                tab === t.value
                  ? "bg-jadeDeep text-stone"
                  : "text-jadeMid hover:text-moss",
              )}
            >
              {t.label}
              {counts[t.value] > 0 && (
                <span
                  className={cn(
                    "ml-1.5 font-mono text-[10px]",
                    tab === t.value ? "text-jade/60" : "text-jade/50",
                  )}
                >
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Load agent bar */}
      <div className="stone-card p-4 mb-6 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1.5">
            Load agent tasks
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone border border-jade/25 rounded-sm px-3 py-2 font-mono
                text-[12px] text-ink placeholder:text-jade/50 outline-none
                focus:border-jadeDark transition-all"
              placeholder="Paste agent pubkey..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadAgent()}
            />
            <button
              onClick={() => loadAgent()}
              disabled={switchLoading || !manualInput.trim()}
              className="px-4 py-2 rounded-sm text-[12px] font-semibold bg-jade/15 border
                border-jade/35 text-jadeDark hover:bg-jade/25 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {switchLoading ? "Loading..." : "Load →"}
            </button>
          </div>
        </div>
        {agentId && (
          <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
            <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">
              Viewing
            </div>
            <div className="font-mono text-[12px] text-jadeDark">
              {agentId.slice(0, 8)}...
            </div>
            <div className="font-mono text-[10px] text-jade mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              <span className="ml-2 text-success">● live</span>
            </div>
          </div>
        )}
        {!agentId && !connected && (
          <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
            <div className="font-mono text-[10px] text-jadeMid">
              Connect wallet or
            </div>
            <div className="font-mono text-[10px] text-jadeMid">
              paste agent ID above
            </div>
          </div>
        )}
      </div>

      {/* Task table */}
      {loading ? (
        <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
          Loading tasks...
        </div>
      ) : !agentId ? (
        <div className="stone-card p-10 text-center">
          <div className="font-display text-lg text-moss mb-2">
            No agent loaded
          </div>
          <p className="text-[13px] text-muted">
            {connected
              ? "Paste an agent pubkey above to view its tasks."
              : "Connect your wallet or paste an agent pubkey above."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
          {tab === "all" ? "No tasks found for this agent" : `No ${tab} tasks`}
        </div>
      ) : (
        <div className="stone-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-jade/15">
                {[
                  "Task ID",
                  "Capability",
                  "Agent",
                  "Requester",
                  "Status",
                  "Created",
                  "Completed",
                  "Stake",
                  "",
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 font-mono text-[10px] text-jadeMid uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr
                  key={t.taskId}
                  className={cn(
                    "border-b border-jade/10 transition-colors hover:bg-jade/5",
                    i % 2 === 0 ? "" : "bg-white/[0.01]",
                  )}
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-jadeDark whitespace-nowrap">
                    {t.taskId.slice(0, 10)}...
                  </td>
                  <td className="px-4 py-3 text-[12px] text-moss font-medium">
                    {t.capabilityName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink">
                    {t.agentName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-jadeMid whitespace-nowrap">
                    {t.requester.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {fmtTime(t.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {fmtTime(t.completedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-jade whitespace-nowrap">
                    {fmtStake(t.stakeAmount)}
                  </td>
                  <td className="px-4 py-3">
                    {t.status === TaskStatus.COMPLETED && (
                      <button
                        onClick={() => setChallenge(toTask(t))}
                        className="px-3 py-1 rounded-sm text-[11px] font-semibold
                          bg-danger/10 border border-danger/25 text-danger
                          hover:bg-danger/20 transition-all whitespace-nowrap"
                      >
                        Challenge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {challenge && (
        <ChallengeModal task={challenge} onClose={() => setChallenge(null)} />
      )}
    </div>
  );
}
