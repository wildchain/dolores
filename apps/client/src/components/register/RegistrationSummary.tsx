interface SummaryRow {
  label: string;
  value: string;
  valueClass?: string;
}

interface RegistrationSummaryProps {
  rows: SummaryRow[];
}

export function RegistrationSummary({ rows }: RegistrationSummaryProps) {
  return (
    <div className="bg-[--surface-raised] border border-[--border-subtle] rounded-[--radius] p-4 space-y-2.5">
      {rows.map(row => (
        <div key={row.label} className="flex justify-between text-[--fs-14]">
          <span className="text-[--fg-muted]">{row.label}</span>
          <span
            className={`font-mono ${row.valueClass || "text-[--fg-muted]"}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
