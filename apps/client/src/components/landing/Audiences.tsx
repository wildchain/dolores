const AUDIENCES = [
  {
    id: "operators",
    kicker: "Operators",
    heading: "Hire agents you can hold accountable.",
    body: "Register any agent, set a bond tier, and let the protocol enforce it. Every action is receipted on-chain — audit without trusting logs.",
    cta: { label: "Register an agent", href: "/register" },
    stats: [
      { value: "0.1 SOL", label: "Minimum bond" },
      { value: "On-chain", label: "Audit trail" },
    ],
  },
  {
    id: "developers",
    kicker: "Developers",
    heading: "One CPI call to gate any action.",
    body: "Add verify_agent() to your Solana program. Below-tier agents are rejected before your instruction runs — no extra logic required.",
    cta: { label: "Read the SDK docs", href: "#docs" },
    code: "verify_agent(ctx, Tier::Two)?;",
    stats: [
      { value: "1 CPI", label: "Integration surface" },
      { value: "Drop-in", label: "No new accounts" },
    ],
  },
  {
    id: "stakers",
    kicker: "Stakers",
    heading: "Earn by catching bad actors.",
    body: "Open a challenge against any suspicious receipt. Provable violations slash the operator's bond — a share goes to the challenger.",
    cta: { label: "Browse receipts", href: "/explorer" },
    stats: [
      { value: "60%", label: "Slash to challenger" },
      { value: "Permissionless", label: "Anyone can challenge" },
    ],
  },
] as const;

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col"
      style={{
        borderLeft: "2px solid var(--border-subtle)",
        paddingLeft: "var(--space-3)",
      }}
    >
      <span
        className="font-mono font-semibold"
        style={{ fontSize: "var(--fs-16)", color: "var(--accent)" }}
      >
        {value}
      </span>
      <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-subtle)" }}>
        {label}
      </span>
    </div>
  );
}

export function Audiences() {
  return (
    <section
      id="audiences"
      className="relative z-10 px-8 py-24"
      style={{ background: "var(--surface-raised)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p
            className="font-semibold uppercase mb-3"
            style={{
              fontSize: "var(--fs-12)",
              letterSpacing: "0.14em",
              color: "var(--fg-muted)",
            }}
          >
            Who it's for
          </p>
          <h2
            className="font-bold"
            style={{
              fontSize: "var(--fs-32)",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "var(--fg)",
              maxWidth: 480,
            }}
          >
            Built for every side of the agent economy.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {AUDIENCES.map(audience => (
            <div
              key={audience.id}
              className="flex flex-col"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-sm)",
                padding: "var(--space-7)",
              }}
            >
              {/* Kicker */}
              <span
                className="inline-block font-semibold uppercase rounded-full mb-5 self-start"
                style={{
                  fontSize: "var(--fs-12)",
                  letterSpacing: "0.06em",
                  color: "var(--accent)",
                  background: "var(--primary-subtle)",
                  border: "1px solid var(--primary)",
                  padding: "3px 10px",
                }}
              >
                {audience.kicker}
              </span>

              <h3
                className="font-bold mb-3"
                style={{
                  fontSize: "var(--fs-20)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.015em",
                  color: "var(--fg)",
                }}
              >
                {audience.heading}
              </h3>

              <p
                className="mb-6 flex-1"
                style={{
                  fontSize: "var(--fs-16)",
                  color: "var(--fg-muted)",
                  lineHeight: 1.6,
                }}
              >
                {audience.body}
              </p>

              {/* Inline code snippet for devs */}
              {"code" in audience && (
                <div
                  className="font-mono mb-6 px-4 py-3 rounded-[var(--radius-sm)]"
                  style={{
                    fontSize: "var(--fs-14)",
                    color: "var(--accent)",
                    background: "var(--primary-subtle)",
                    border: "1px solid var(--primary)",
                  }}
                >
                  {audience.code}
                </div>
              )}

              {/* Stats */}
              <div className="flex gap-6 mb-6">
                {audience.stats.map(s => (
                  <StatPill key={s.label} value={s.value} label={s.label} />
                ))}
              </div>

              {/* CTA */}
              <a
                href={audience.cta.href}
                className="font-semibold transition-opacity hover:opacity-70 self-start"
                style={{
                  fontSize: "var(--fs-14)",
                  color: "var(--accent)",
                }}
              >
                {audience.cta.label} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
