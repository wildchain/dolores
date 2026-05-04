"use client";
import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { AttestationRecord } from "@/lib/api";
import { cn } from "@/lib/data";

const PAGE_SIZE = 20;

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-success/10 text-success border-success/25"
      : score >= 50
        ? "bg-amber/10 text-amber border-amber/25"
        : "bg-danger/10 text-danger border-danger/25";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[11px] font-semibold",
        color,
      )}
    >
      {score}
    </span>
  );
}

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (nextOffset: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = await apiClient.attestations.getAll({
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      const rows = res.data;
      setAttestations(prev => (replace ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, true);
  }, [load]);

  function prev() {
    const next = Math.max(0, offset - PAGE_SIZE);
    setOffset(next);
    load(next, true);
  }

  function next() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    load(next, true);
  }

  return (
    <div className="px-8 py-8 relative z-10">
      {/* Header */}
      <div className="mb-6">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
          On-chain Records
        </p>
        <h1
          className="font-display text-4xl font-medium text-moss mb-1.5"
          style={{ letterSpacing: "-0.02em" }}
        >
          Attestations
        </h1>
        <p className="text-[14px] text-muted">
          All agent attestations, sorted newest first
        </p>
      </div>

      {/* Table */}
      <div className="stone-card overflow-hidden">
        {loading && attestations.length === 0 ? (
          <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
            Loading attestations...
          </div>
        ) : attestations.length === 0 ? (
          <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
            No attestations found
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-jade/15">
                {[
                  "Agent",
                  "Score",
                  "New Reputation",
                  "Output Hash",
                  "Attested At",
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
              {attestations.map((a, i) => (
                <tr
                  key={`${a.agentId}-${a.attestedAt}-${i}`}
                  className={cn(
                    "border-b border-jade/10 transition-colors hover:bg-jade/5",
                    i % 2 !== 0 && "bg-white/[0.01]",
                  )}
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-jadeDark whitespace-nowrap">
                    {a.agentId.slice(0, 8)}...{a.agentId.slice(-4)}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={a.score} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink">
                    {a.newReputation}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">
                    {Buffer.from(a.outputHash).toString("hex").slice(0, 16)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {fmtTime(a.attestedAt)}
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
              {offset + 1}–{offset + attestations.length}
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
    </div>
  );
}
