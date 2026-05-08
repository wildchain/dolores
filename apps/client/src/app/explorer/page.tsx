"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/agents/AgentCard";
import { apiClient } from "@/lib/api";
import type { AgentListItemDto } from "@dolores/shared";

export default function ExplorerPage() {
  const [q, setQ] = useState("");
  const [cap, setCap] = useState("All");
  const [minRep, setMinRep] = useState(0);

  const agentsQuery = useQuery({
    queryKey: ["agents", { limit: 100, offset: 0 }],
    queryFn: () => apiClient.agents.getAgents({ limit: 100, offset: 0 }),
  });

  const agents = agentsQuery.data?.data ?? [];

  const filtered = useMemo(
    () =>
      agents.filter(a => {
        const mq =
          !q ||
          a.name?.toLowerCase().includes(q.toLowerCase()) ||
          a.agentId?.toLowerCase().includes(q.toLowerCase());
        const mc = cap === "All" || (a.capabilities ?? []).includes(cap);
        const mr = (a.trustBadge?.successRate ?? 0) / 100 >= minRep;
        return mq && mc && mr;
      }),
    [agents, q, cap, minRep],
  );

  const fieldStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border-subtle)",
    color: "var(--fg)",
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "var(--fs-14)",
    borderRadius: "var(--radius-sm)",
  };

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="mb-8">
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "var(--fs-12)",
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: ".14em",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Agent Registry
        </p>
        <h1
          className="font-bold mb-2"
          style={{
            fontSize: "var(--fs-32)",
            letterSpacing: "-0.02em",
            color: "var(--fg)",
          }}
        >
          Agent Explorer
        </h1>
        <p style={{ fontSize: "var(--fs-16)", color: "var(--fg-muted)" }}>
          Browse registered agents by reputation, stake, and capability
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          style={{ ...fieldStyle, width: 224, padding: "7px 14px" }}
          placeholder="Search agents..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          style={{ ...fieldStyle, padding: "7px 14px", cursor: "pointer" }}
          onChange={e => setCap(e.target.value)}
        >
          {[
            "All",
            "SOL_TRANSFER",
            "DEX_TRADER_V1",
            "LP_MANAGER_V1",
            "YIELD_OPTIMIZER_V1",
            "ORACLE_READER_V1",
          ].map(o => (
            <option key={o} style={{ background: "var(--bg)" }}>
              {o}
            </option>
          ))}
        </select>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "var(--fs-12)",
            color: "var(--fg-muted)",
          }}
        >
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
          {agentsQuery.isSuccess && (
            <span style={{ marginLeft: 8, color: "var(--ok)" }}>● live</span>
          )}
        </span>
      </div>

      {agentsQuery.isLoading && (
        <div className="text-center py-16">
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-14)",
              color: "var(--fg-muted)",
            }}
          >
            Loading agents...
          </p>
        </div>
      )}

      {!agentsQuery.isLoading && agents.length === 0 && (
        <div className="text-center py-16">
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-14)",
              color: "var(--fg-muted)",
              marginBottom: 8,
            }}
          >
            No agents registered
          </p>
          <p style={{ fontSize: "var(--fs-12)", color: "var(--fg-subtle)" }}>
            Start the indexer to see live agents
          </p>
        </div>
      )}

      {!agentsQuery.isLoading && agents.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-14)",
              color: "var(--fg-muted)",
              marginBottom: 8,
            }}
          >
            No agents match your filters
          </p>
          <p style={{ fontSize: "var(--fs-12)", color: "var(--fg-subtle)" }}>
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {!agentsQuery.isLoading && filtered.length > 0 && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(305px,1fr))" }}
        >
          {filtered.map(a => (
            <div key={a.agentId} className="group">
              <AgentCard agent={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
