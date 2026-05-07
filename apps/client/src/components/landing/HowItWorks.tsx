const STEPS = [
  {
    number: "01",
    label: "Verify",
    heading: "On-chain identity check",
    body: "Every agent registers a keypair and capability manifest. The CPI gate reads both before allowing any call through.",
  },
  {
    number: "02",
    label: "Gate",
    heading: "Capability-scoped execution",
    body: "Actions are bounded by the locked capability template. Anything outside the manifest is rejected at the program level — no runtime surprises.",
  },
  {
    number: "03",
    label: "Receipt",
    heading: "Immutable execution trace",
    body: "Every successful call mints a receipt account. Operators can audit the full action history without trusting the agent's logs.",
  },
  {
    number: "04",
    label: "Challenge",
    heading: "Stake-backed accountability",
    body: "Any receipt can be challenged on-chain. Proven violations slash the agent's bond and route funds to the challenger.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative z-10 px-8 py-24"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-16">
          <p
            className="font-semibold uppercase mb-3"
            style={{
              fontSize: "var(--fs-12)",
              letterSpacing: "0.14em",
              color: "var(--fg-muted)",
            }}
          >
            How it works
          </p>
          <h2
            className="font-bold mb-4"
            style={{
              fontSize: "var(--fs-44)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
              maxWidth: 640,
            }}
          >
            Verify → gate → receipt →{" "}
            <span style={{ color: "var(--fg)" }}>challenge.</span>
          </h2>
          <p
            style={{
              fontSize: "var(--fs-18)",
              color: "var(--fg-muted)",
              lineHeight: 1.5,
            }}
          >
            Four primitives, drop-in. No new mental model.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-sm)",
                padding: "var(--space-6)",
              }}
            >
              {/* Step number + connector */}
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="font-mono font-semibold"
                  style={{
                    fontSize: "var(--fs-12)",
                    color: "var(--accent)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {step.number}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--border-subtle), transparent)",
                    }}
                  />
                )}
              </div>

              {/* Label chip */}
              <span
                className="inline-block font-semibold uppercase rounded-full mb-4"
                style={{
                  fontSize: "var(--fs-12)",
                  letterSpacing: "0.06em",
                  color: "var(--accent)",
                  background: "var(--primary-subtle)",
                  border: "1px solid var(--primary)",
                  padding: "3px 10px",
                }}
              >
                {step.label}
              </span>

              <h3
                className="font-semibold mb-2"
                style={{
                  fontSize: "var(--fs-16)",
                  color: "var(--fg)",
                  lineHeight: 1.3,
                }}
              >
                {step.heading}
              </h3>
              <p
                style={{
                  fontSize: "var(--fs-14)",
                  color: "var(--fg-muted)",
                  lineHeight: 1.6,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
