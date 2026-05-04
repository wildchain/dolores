"use client";
import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { AttestationRecord } from "@/lib/api";
import {
  AttestationRow,
  AttestationDetailsModal,
} from "@/components/attestations";

const PAGE_SIZE = 20;

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<AttestationRecord | null>(null);

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
                {["Agent", "Score", "New Reputation", "Output Hash", "Attested At"].map(
                  h => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[10px] text-jadeMid uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {attestations.map((a, i) => (
                <AttestationRow
                  key={`${a.agentId}-${a.attestedAt}-${i}`}
                  attestation={a}
                  index={i}
                  onClick={setSelected}
                />
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

      <AttestationDetailsModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        attestation={selected}
      />
    </div>
  );
}
