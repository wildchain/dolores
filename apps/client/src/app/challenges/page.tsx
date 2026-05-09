"use client";
import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { ChallengeCacheData } from "@/lib/api";
import { cn } from "@/lib/data";

const PAGE_SIZE = 20;

function fmtTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function ChallengeBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === "filed" || s === "disputed"
      ? "bg-amber/10 text-amber border-amber/25"
      : s === "resolved" || s === "completed"
        ? "bg-success/10 text-success border-success/25"
        : s === "dismissed" || s === "failed"
          ? "bg-jade/10 text-jadeMid border-jade/20"
          : "bg-jade/10 text-jadeMid border-jade/20";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[11px] font-semibold",
        cls,
      )}
    >
      {status ?? "—"}
    </span>
  );
}

function ChallengeDetailsModal({
  challenge: c,
  onClose,
}: {
  challenge: ChallengeCacheData | null;
  onClose: () => void;
}) {
  if (!c) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-[--bg] border border-[--border-subtle] rounded-[--radius-lg] shadow-[--shadow-lg] w-full max-w-lg p-7 animate-fade-up overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className="font-sans text-[--fs-20] font-semibold text-[--fg]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Challenge Details
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-[--fs-12] text-[--fg-subtle] hover:text-[--fg] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {(
            [
              ["Challenge PDA", c.challengePda],
              ["Task ID", c.taskId],
              ["Agent", c.agentId],
              ["Requester", c.requester],
              ["Capability", c.capabilityName || "—"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="font-mono text-[--fs-12] text-[--fg-subtle] whitespace-nowrap">
                {label}
              </span>
              <span
                className="font-mono text-[--fs-12] text-[--fg] text-right break-all"
                style={{ maxWidth: 280 }}
              >
                {value}
              </span>
            </div>
          ))}

          <div className="flex justify-between gap-4">
            <span className="font-mono text-[--fs-12] text-[--fg-subtle]">
              Status
            </span>
            <ChallengeBadge status={c.status} />
          </div>

          <div className="flex justify-between gap-4">
            <span className="font-mono text-[--fs-12] text-[--fg-subtle]">
              Filed At
            </span>
            <span className="font-mono text-[--fs-12] text-[--fg-muted]">
              {fmtTime(c.createdAt)}
            </span>
          </div>

          {c.completedAt && (
            <div className="flex justify-between gap-4">
              <span className="font-mono text-[--fs-12] text-[--fg-subtle]">
                Completed At
              </span>
              <span className="font-mono text-[--fs-12] text-[--fg-muted]">
                {fmtTime(c.completedAt)}
              </span>
            </div>
          )}

          {c.adjudicatedAt && (
            <div className="flex justify-between gap-4">
              <span className="font-mono text-[--fs-12] text-[--fg-subtle]">
                Adjudicated At
              </span>
              <span className="font-mono text-[--fs-12] text-[--fg-muted]">
                {fmtTime(c.adjudicatedAt)}
              </span>
            </div>
          )}

          {c.adjudicatedBy && (
            <div className="flex justify-between gap-4">
              <span className="font-mono text-[--fs-12] text-[--fg-subtle]">
                Adjudicated By
              </span>
              <span
                className="font-mono text-[--fs-12] text-[--fg] break-all text-right"
                style={{ maxWidth: 280 }}
              >
                {c.adjudicatedBy}
              </span>
            </div>
          )}

          {c.receiptUrl && (
            <div className="pt-2 border-t border-[--border-subtle]">
              <div className="font-mono text-[--fs-12] text-[--fg-subtle] uppercase tracking-[.08em] mb-1.5">
                Receipt
              </div>
              <a
                href={c.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[--fs-12] text-[--accent] hover:text-[--fg] break-all transition-colors"
              >
                {c.receiptUrl} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeCacheData[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<ChallengeCacheData | null>(null);
  const [agentFilter, setAgentFilter] = useState("");
  const [agentInput, setAgentInput] = useState("");

  const load = useCallback(
    async (nextOffset: number, replace: boolean, agent?: string) => {
      setLoading(true);
      try {
        const res = await apiClient.challenges.getChallenges({
          limit: PAGE_SIZE,
          offset: nextOffset,
          agentId: agent || undefined,
        });
        const rows = res.data;
        setChallenges(prev => (replace ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        // silently ignore fetch errors
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(0, true, agentFilter || undefined);
  }, [load, agentFilter]);

  function applyFilter() {
    const trimmed = agentInput.trim();
    setAgentFilter(trimmed);
    setOffset(0);
  }

  function clearFilter() {
    setAgentInput("");
    setAgentFilter("");
    setOffset(0);
  }

  function prev() {
    const next = Math.max(0, offset - PAGE_SIZE);
    setOffset(next);
    load(next, true, agentFilter || undefined);
  }

  function next() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    load(next, true, agentFilter || undefined);
  }

  return (
    <div className="px-8 py-8 relative z-10">
      {/* Header */}
      <div className="mb-6">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
          Dispute Registry
        </p>
        <h1
          className="font-display text-4xl font-medium text-moss mb-1.5"
          style={{ letterSpacing: "-0.02em" }}
        >
          Challenges
        </h1>
        <p className="text-[14px] text-muted">
          All on-chain challenges and their adjudication status
        </p>
      </div>

      {/* Filter bar */}
      <div className="stone-card p-4 mb-6 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1.5">
            Filter by agent
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone border border-jade/25 rounded-sm px-3 py-2 font-mono
                text-[12px] text-ink placeholder:text-jade/50 outline-none
                focus:border-jadeDark transition-all"
              placeholder="Paste agent pubkey..."
              value={agentInput}
              onChange={e => setAgentInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilter()}
            />
            <button
              onClick={applyFilter}
              disabled={!agentInput.trim()}
              className="px-4 py-2 rounded-sm text-[12px] font-semibold bg-jade/15 border
                border-jade/35 text-jadeDark hover:bg-jade/25 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              Filter →
            </button>
            {agentFilter && (
              <button
                onClick={clearFilter}
                className="px-4 py-2 rounded-sm text-[12px] font-semibold border
                  border-jade/20 text-jadeMid hover:text-moss transition-all flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {agentFilter && (
          <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
            <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">
              Filtering
            </div>
            <div className="font-mono text-[12px] text-jadeDark">
              {agentFilter.slice(0, 8)}...
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="stone-card overflow-hidden">
        {loading && challenges.length === 0 ? (
          <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
            Loading challenges...
          </div>
        ) : challenges.length === 0 ? (
          <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
            No challenges found
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-jade/15">
                {[
                  "Challenge PDA",
                  "Task ID",
                  "Agent",
                  "Requester",
                  "Capability",
                  "Status",
                  "Filed At",
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
              {challenges.map((c, i) => (
                <tr
                  key={c.challengePda}
                  onClick={() => setSelected(c)}
                  className={cn(
                    "border-b border-jade/10 transition-colors hover:bg-jade/5 cursor-pointer",
                    i % 2 !== 0 && "bg-white/[0.01]",
                  )}
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-jadeDark whitespace-nowrap">
                    {c.challengePda.slice(0, 8)}...{c.challengePda.slice(-4)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {c.taskId ? `${c.taskId.slice(0, 10)}...` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink whitespace-nowrap">
                    {c.agentId.slice(0, 8)}...{c.agentId.slice(-4)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {c.requester.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-[12px] text-moss font-medium">
                    {c.capabilityName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ChallengeBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {fmtTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-jade/15">
            <button
              onClick={prev}
              disabled={offset === 0 || loading}
              className="px-4 py-1.5 rounded-sm text-[12px] font-semibold bg-jade/10 border
                border-jade/25 text-jadeDark hover:bg-jade/20 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="font-mono text-[11px] text-jadeMid">
              {offset + 1}–{offset + challenges.length}
            </span>
            <button
              onClick={next}
              disabled={!hasMore || loading}
              className="px-4 py-1.5 rounded-sm text-[12px] font-semibold bg-jade/10 border
                border-jade/25 text-jadeDark hover:bg-jade/20 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <ChallengeDetailsModal
        challenge={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
