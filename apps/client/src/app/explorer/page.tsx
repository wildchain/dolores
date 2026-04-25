"use client";
import { useState, useMemo, useEffect } from "react";
import { AgentCard } from "@/components/agents/AgentCard";
import { MOCK_AGENTS } from "@/lib/data";

const INDEXER = "http://localhost:8080";

export default function ExplorerPage() {
  const [q, setQ] = useState("");
  const [cap, setCap] = useState("All");
  const [minRep, setMinRep] = useState(0);
  const [agents, setAgents] = useState(MOCK_AGENTS); // ← start with mock, not empty
  const [indexerOnline, setIndexerOnline] = useState(false);

  useEffect(() => {
    fetch(`${INDEXER}/agents`)
      .then(r => {
        if (!r.ok) throw new Error("not ok");
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
          setIndexerOnline(true);
        }
      })
      .catch(() => {
        // indexer offline — keep showing mock data, no crash
        setIndexerOnline(false);
      });
  }, []);

  const filtered = useMemo(
    () =>
      agents.filter((a: any) => {
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

  const fieldStyle = {
    background: "rgba(244,242,237,0.9)",
    border: "1px solid rgba(174,184,160,0.4)",
    color: "#242820",
    outline: "none",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "13px",
  };

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="mb-8">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
          Agent Registry
        </p>
        <h1
          className="font-display text-4xl font-medium text-moss mb-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Agent Explorer
        </h1>
        <p className="text-[14px] text-muted">
          Browse registered agents by reputation, stake, and capability
        </p>
      </div>

      {/* Indexer status banner */}
      {!indexerOnline && (
        <div
          className="mb-5 px-4 py-2.5 rounded-sm font-mono text-[11px] flex items-center gap-2"
          style={{
            background: "rgba(139,106,44,0.08)",
            border: "1px solid rgba(139,106,44,0.2)",
            color: "#8B6A2C",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />
          Indexer offline — showing mock data. Start the indexer on port 8080 to
          see live agents.
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          style={fieldStyle}
          className="rounded-sm px-3.5 py-2 w-56 placeholder:text-jade/60"
          placeholder="Search agents..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          style={fieldStyle}
          className="rounded-sm px-3.5 py-2 cursor-pointer"
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
            <option key={o} style={{ background: "#F4F2ED" }}>
              {o}
            </option>
          ))}
        </select>
        <select
          style={fieldStyle}
          className="rounded-sm px-3.5 py-2 cursor-pointer"
          onChange={e => setMinRep(Number(e.target.value))}
        >
          {[
            { l: "All reputations", v: 0 },
            { l: "70+ score", v: 70 },
            { l: "50+ score", v: 50 },
          ].map(o => (
            <option key={o.l} value={o.v} style={{ background: "#F4F2ED" }}>
              {o.l}
            </option>
          ))}
        </select>
        <span className="font-mono text-[12px] text-jadeMid">
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
          {indexerOnline && <span className="ml-2 text-success">● live</span>}
        </span>
      </div>

      <div
        className="grid gap-4 stagger"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(305px,1fr))" }}
      >
        {filtered.map((a: any) => (
          <div key={a.agentId} className="group animate-fade-up">
            <AgentCard agent={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
