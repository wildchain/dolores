import { cn } from "@/lib/data";

export function ScoreBadge({ score }: { score: number }) {
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
