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
    <div className="bg-jade/8 border border-jade/20 rounded-sm p-4 space-y-2.5">
      {rows.map(row => (
        <div key={row.label} className="flex justify-between text-[12px]">
          <span className="text-muted">{row.label}</span>
          <span className={`font-mono ${row.valueClass || "text-jadeMid"}`}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
