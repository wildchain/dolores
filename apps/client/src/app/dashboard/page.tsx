"use client";
import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/ui";
import { useWalletState } from "@/hooks/useWalletState";
import { agentsApi } from "@/lib/api";
import { cn } from "@/lib/data";
import type { AgentListItemDto } from "@dolores/shared";

function getTier(reputation: number, slashCount: number) {
  if (slashCount >= 3) return { label: "Banned", cls: "text-danger" };
  if (reputation >= 850) return { label: "Exemplary", cls: "text-success" };
  if (reputation >= 650) return { label: "Established", cls: "text-success" };
  if (reputation >= 400) return { label: "Developing", cls: "text-jadeDark" };
  if (reputation >= 150) return { label: "Provisional", cls: "text-amber" };
  return { label: "", cls: "text-amber" };
}

function AgentRow({ agent }: { agent: AgentListItemDto }) {
  const tier = getTier(agent.reputationScore, agent.slashCount);
  const stake = (agent.stakeAmount / 1e9).toFixed(3);
  const successRate = agent.trustBadge?.successRate ?? 0;

  return (
    <tr className="border-b border-jade/10 hover:bg-jade/5 transition-colors group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-sm bg-jade/15 border border-jade/25 flex items-center justify-center
            font-display text-sm font-medium text-moss flex-shrink-0"
          >
            {agent.agentId.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[13px] font-medium text-moss">
              {agent.name || "—"}
            </div>
            <div className="font-mono text-[10px] text-jadeMid mt-0.5">
              {agent.agentId.slice(0, 12)}...
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map(c => (
            <span
              key={c}
              className="font-mono text-[10px] text-jadeDark bg-jade/10 border border-jade/20 px-1.5 py-0.5 rounded-sm"
            >
              {c}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="font-mono text-[10px] text-jade">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-jade/15 rounded-sm overflow-hidden w-20">
            <div
              className="h-full bg-jadeDark rounded-sm"
              style={{ width: `${(agent.reputationScore / 10000) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-jadeDark">
            {agent.reputationScore.toLocaleString()}
          </span>
        </div>
        <div className={cn("font-mono text-[10px] mt-0.5", tier.cls)}>
          {tier.label}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="font-mono text-[12px] text-moss">{stake} SOL</div>
      </td>
      <td className="px-5 py-4">
        <div className="font-mono text-[12px] text-moss">
          {agent.trustBadge?.totalTasks ?? 0}
        </div>
        <div className="font-mono text-[10px] text-jadeMid mt-0.5">
          {successRate.toFixed(0)}% success
        </div>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={"active"} />
      </td>
      <td className="px-5 py-4">
        <span className="font-mono text-[11px] text-jadeMid">
          {agent.slashCount === 0 ? "—" : agent.slashCount}
        </span>
      </td>
      <td className="px-5 py-4">
        <a
          href={`/agents/${agent.agentId}`}
          className="font-mono text-[11px] text-jadeDark border border-jade/30 rounded-sm px-3 py-1.5
            hover:bg-jade/10 transition-all opacity-0 group-hover:opacity-100"
        >
          View →
        </a>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { address, connected } = useWalletState();
  const [agents, setAgents] = useState<AgentListItemDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setAgents([]);
      return;
    }
    setLoading(true);
    agentsApi
      .getAgents({ limit: 100 })
      .then(res => setAgents(res.data.filter(a => a.operator === address)))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="mb-7">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
          Operator
        </p>
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="font-display text-4xl font-medium text-moss mb-1.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              Dashboard
            </h1>
            <p className="text-[14px] text-muted">Your registered agents</p>
          </div>
          {address && (
            <div className="text-right">
              <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">
                Operator wallet
              </div>
              <div className="font-mono text-[12px] text-jadeDark">
                {address.slice(0, 8)}...{address.slice(-6)}
              </div>
            </div>
          )}
        </div>
      </div>

      {!connected ? (
        <div className="stone-card p-12 text-center max-w-md mx-auto">
          <div className="font-display text-xl text-moss mb-2">
            Connect your wallet
          </div>
          <p className="text-[13px] text-muted">
            Connect your operator wallet to see your agents.
          </p>
        </div>
      ) : loading ? (
        <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <div className="stone-card p-12 text-center">
          <div className="font-display text-lg text-moss mb-2">
            No agents found
          </div>
          <p className="text-[13px] text-muted mb-6">
            No agents are registered to this wallet yet.
          </p>
          <a
            href="/register"
            className="inline-block px-5 py-2.5 rounded-sm text-[13px] font-semibold bg-jade/15
              border border-jade/35 text-jadeDark hover:bg-jade/25 transition-all"
          >
            Register Agent →
          </a>
        </div>
      ) : (
        <div className="stone-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-jade/15">
                {[
                  "Agent",
                  "Capabilities",
                  "Reputation",
                  "Stake",
                  "Tasks",
                  "Status",
                  "Slashes",
                  "",
                ].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3 font-mono text-[10px] text-jadeMid uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <AgentRow key={a.agentId} agent={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
