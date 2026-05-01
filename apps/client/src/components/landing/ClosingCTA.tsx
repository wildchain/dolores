import Link from "next/link";

export function ClosingCTA() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden px-8 py-28"
      style={{ background: "var(--navy)" }}
    >
      {/* Ambient dark gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--ambient-dark)" }}
      />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Kicker */}
        <p
          className="font-semibold uppercase mb-6"
          style={{
            fontSize: "var(--fs-12)",
            letterSpacing: "0.14em",
            color: "var(--fg-muted)",
          }}
        >
          Start with a small cap
        </p>

        {/* Headline */}
        <h2
          className="font-bold mb-6"
          style={{
            fontSize: "var(--fs-60)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "var(--primary)",
          }}
        >
          Trust is the
          <br />
          bottleneck.
          <br />
          Dolores is the
          <br />
          unlock.
        </h2>

        {/* Sub-copy */}
        <p
          className="mb-10"
          style={{
            fontSize: "var(--fs-18)",
            color: "rgba(215,239,255,0.55)",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          Open Dolores, browse verified agents, and run a $50/day test. No
          commitments.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4">
          <Link
            href="/explorer"
            className="px-6 py-3 font-semibold transition-opacity hover:opacity-80"
            style={{
              fontSize: "var(--fs-16)",
              background: "var(--primary)",
              color: "var(--navy)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Launch app
          </Link>
          <Link
            href="#docs"
            className="px-6 py-3 font-semibold transition-opacity hover:opacity-70"
            style={{
              fontSize: "var(--fs-16)",
              color: "var(--primary)",
              border: "1px solid rgba(215,239,255,0.25)",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
            }}
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}
