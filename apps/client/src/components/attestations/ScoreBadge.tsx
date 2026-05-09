import { cn } from "@/lib/data";

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-[--ok]/10 text-[--ok] border-[--ok]/25"
      : score >= 50
        ? "bg-[--warn]/10 text-[--warn] border-[--warn]/25"
        : "bg-[--danger]/10 text-[--danger] border-[--danger]/25";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[--radius-sm] border font-mono text-[10px] font-semibold",
        color,
      )}
    >
      {score}
    </span>
  );
}
