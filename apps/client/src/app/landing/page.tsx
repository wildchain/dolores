"use client";
import Link from "next/link";
import { ProtocolGlance } from "@/components/landing/ProtocolGlance";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Audiences } from "@/components/landing/Audiences";
import { ClosingCTA } from "@/components/landing/ClosingCTA";
import { Footer } from "@/components/landing/Footer";

const NAV_LINKS = [
  { href: "#protocol", label: "Protocol" },
  { href: "#audiences", label: "Audiences" },
  { href: "#sdk", label: "SDK" },
  { href: "#docs", label: "Docs" },
];

type TerminalLine = {
  text: string;
  type: "cmd" | "ok" | "err" | "comment" | "blank";
  fn?: string;
  highlight?: string;
};

const TERMINAL_LINES: TerminalLine[] = [
  { text: "$ dolores verify --agent ag_0x7f3a", type: "cmd" },
  { text: "✓ identity: verified", type: "ok" },
  { text: "✓ bond: 5,000 USDC", type: "ok", highlight: "5,000" },
  { text: "✓ tier: 2 · 148 receipts", type: "ok", highlight: "148" },
  { text: "", type: "blank" },
  { text: "$ dolores call --action swap --amount 100", type: "cmd" },
  { text: "// gate check…", type: "comment" },
  {
    text: "✓ verify_agent(Tier::Two) PASS",
    type: "ok",
    fn: "verify_agent(Tier::Two)",
  },
  { text: "✓ swap executed · receipt rcp_0x9a2c", type: "ok" },
  { text: "", type: "blank" },
  {
    text: "$ dolores call --action withdraw --amount 10000",
    type: "cmd",
    highlight: "10000",
  },
  {
    text: "✗ verify_agent(Tier::Three) BLOCKED",
    type: "err",
    fn: "verify_agent(Tier::Three)",
  },
  { text: "// no funds moved. switched to ag_0x4b21", type: "comment" },
] satisfies TerminalLine[];

export default function Landing() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--fg)" }}
    >
      {/* Ambient gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "var(--ambient-light)", zIndex: 0 }}
      />

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-8 h-14"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold select-none"
          style={{
            fontSize: "var(--fs-20)",
            letterSpacing: "-0.02em",
            color: "var(--fg)",
          }}
        >
          <span
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] font-bold text-[var(--fg-inverse)]"
            style={{
              fontSize: "var(--fs-14)",
              background: "var(--fg)",
            }}
          >
            D
          </span>
          Dolores
        </Link>

        {/* Center links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors duration-150"
              style={{
                fontSize: "var(--fs-14)",
                color: "var(--fg-muted)",
              }}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--fg)")
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--fg-muted)")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <Link
          href="/explorer"
          className="px-5 py-2 rounded-[var(--radius-sm)] font-semibold transition-opacity duration-150 hover:opacity-80"
          style={{
            fontSize: "var(--fs-14)",
            background: "var(--fg)",
            color: "var(--fg-inverse)",
          }}
        >
          Launch app →
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 px-8 pt-20 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div>
            {/* Kicker chip */}
            <div className="mb-8">
              <span
                className="inline-flex items-center gap-2 rounded-full font-semibold uppercase tracking-[.06em]"
                style={{
                  fontSize: "var(--fs-12)",
                  color: "var(--accent)",
                  background: "var(--primary-subtle)",
                  border: "1px solid var(--primary)",
                  padding: "4px 12px",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--ok)" }}
                />
                Live on Solana Devnet
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-bold mb-6"
              style={{
                fontSize: "var(--fs-60)",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                color: "var(--fg)",
              }}
            >
              Stop blindly
              <br />
              trusting
              <br />
              <span style={{ color: "var(--accent)" }}>agents.</span>
            </h1>

            {/* Sub-headline */}
            <p
              className="mb-10 font-normal"
              style={{
                fontSize: "var(--fs-20)",
                color: "var(--fg-muted)",
                lineHeight: 1.5,
              }}
            >
              Hire agents you can verify.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4">
              <Link
                href="/explorer"
                className="px-6 py-3 rounded-[var(--radius-sm)] font-semibold transition-opacity hover:opacity-80"
                style={{
                  fontSize: "var(--fs-16)",
                  background: "var(--fg)",
                  color: "var(--fg-inverse)",
                }}
              >
                Launch app
              </Link>
              <Link
                href="#docs"
                className="px-6 py-3 rounded-[var(--radius-sm)] font-semibold transition-colors hover:border-[var(--fg)]"
                style={{
                  fontSize: "var(--fs-16)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                }}
              >
                Read the docs
              </Link>
            </div>
          </div>

          {/* Right column — terminal */}
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden"
            style={{
              background: "var(--navy)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid rgba(215,239,255,0.08)",
            }}
          >
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: "1px solid rgba(215,239,255,0.07)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <div className="flex items-center gap-1.5">
                {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
                  <div
                    key={c}
                    className="w-3 h-3 rounded-full"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: "var(--fs-12)",
                  color: "rgba(215,239,255,0.35)",
                }}
              >
                ~/swap_program.rs
              </span>
              <div className="w-12" />
            </div>

            {/* Code lines */}
            <div
              className="p-5 font-mono space-y-0.5"
              style={{ fontSize: "var(--fs-14)", lineHeight: 1.7 }}
            >
              {TERMINAL_LINES.map((line, i) => {
                if (line.type === "blank")
                  return <div key={i} className="h-3" />;
                if (line.type === "comment")
                  return (
                    <div key={i} style={{ color: "rgba(215,239,255,0.3)" }}>
                      {line.text}
                    </div>
                  );
                if (line.type === "cmd") {
                  // highlight the number after --amount if present
                  const parts = line.text.split(/(\d{3,})/);
                  return (
                    <div key={i} style={{ color: "var(--primary)" }}>
                      {parts.map((p, j) =>
                        /^\d{3,}$/.test(p) ? (
                          <span key={j} style={{ color: "var(--warn)" }}>
                            {p}
                          </span>
                        ) : (
                          p
                        ),
                      )}
                    </div>
                  );
                }
                if (line.type === "ok") {
                  // highlight function calls
                  const hasFn = "fn" in line && line.fn;
                  if (hasFn) {
                    const idx = line.text.indexOf(line.fn as string);
                    return (
                      <div key={i} style={{ color: "var(--primary)" }}>
                        <span style={{ color: "var(--ok)" }}>✓ </span>
                        <span style={{ color: "var(--accent)" }}>
                          {line.fn}
                        </span>
                        {line.text.slice(idx + (line.fn as string).length)}
                      </div>
                    );
                  }
                  // highlight standalone numbers
                  const parts = line.text
                    .replace(/^✓ /, "")
                    .split(/(\d[\d,]+)/);
                  return (
                    <div key={i} style={{ color: "var(--primary)" }}>
                      <span style={{ color: "var(--ok)" }}>✓ </span>
                      {parts.map((p, j) =>
                        /^[\d,]+$/.test(p) ? (
                          <span key={j} style={{ color: "var(--warn)" }}>
                            {p}
                          </span>
                        ) : (
                          p
                        ),
                      )}
                    </div>
                  );
                }
                if (line.type === "err") {
                  const hasFn = "fn" in line && line.fn;
                  const idx = hasFn ? line.text.indexOf(line.fn as string) : -1;
                  return (
                    <div key={i} style={{ color: "var(--primary)" }}>
                      <span style={{ color: "var(--danger)" }}>✗ </span>
                      {hasFn ? (
                        <>
                          <span style={{ color: "var(--accent)" }}>
                            {line.fn}
                          </span>
                          <span style={{ color: "var(--danger)" }}>
                            {line.text.slice(idx + (line.fn as string).length)}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "var(--danger)" }}>
                          {line.text.replace(/^✗ /, "")}
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </section>

      <ProtocolGlance />
      <HowItWorks />
      <Audiences />
      <ClosingCTA />
      <Footer />
    </div>
  );
}
