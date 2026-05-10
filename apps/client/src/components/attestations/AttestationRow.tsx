import { cn } from "@/lib/data";
import type { AttestationRecord } from "@/lib/api";
import { ScoreBadge } from "./ScoreBadge";

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

interface AttestationRowProps {
  attestation: AttestationRecord;
  index: number;
  onClick: (attestation: AttestationRecord) => void;
}

export function AttestationRow({
  attestation: a,
  index: i,
  onClick,
}: AttestationRowProps) {
  const outputHex = Array.isArray(a.outputHash)
    ? Buffer.from(a.outputHash).toString("hex")
    : "";

  return (
    <tr
      onClick={() => onClick(a)}
      className={cn(
        "border-b border-[--border-subtle]/50 transition-colors hover:bg-[--surface-raised] cursor-pointer",
        i % 2 !== 0 && "bg-white/[0.01]",
      )}
    >
      <td className="px-4 py-3 font-mono text-[11px] text-[--fg] whitespace-nowrap">
        {a.agentId.slice(0, 8)}...{a.agentId.slice(-4)}
      </td>
      <td className="px-4 py-3">
        <ScoreBadge score={a.score} />
      </td>
      <td className="px-4 py-3 font-mono text-[11px] text-[--fg]">
        {a.newReputation}
      </td>
      <td className="px-4 py-3 font-mono text-[11px] text-[--fg-muted]">
        {outputHex.slice(0, 16)}…
      </td>
      <td className="px-4 py-3 font-mono text-[11px] text-[--fg-muted] whitespace-nowrap">
        {fmtTime(a.attestedAt)}
      </td>
    </tr>
  );
}
