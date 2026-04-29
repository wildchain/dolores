type Step = 1 | 2 | 3;

interface StepIndicatorProps {
  current: Step;
  steps: { number: Step; label: string }[];
}

export function StepIndicator({ current, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((step, i) => (
        <div
          key={step.number}
          className="flex items-center gap-2 flex-1 last:flex-none"
        >
          <div
            className="w-2 h-2 rounded-sm transition-all duration-300"
            style={{
              background: step.number <= current ? "#4A5640" : "#AEB8A0",
              boxShadow:
                step.number === current
                  ? "0 0 0 3px rgba(107,122,96,0.2)"
                  : "none",
            }}
          />
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px transition-all duration-300"
              style={{
                background:
                  step.number < current
                    ? "rgba(74,86,64,0.5)"
                    : "rgba(174,184,160,0.3)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
