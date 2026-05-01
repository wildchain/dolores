import Link from "next/link";

const FOOTER_LINKS = [
  { label: "App", href: "/explorer" },
  { label: "Docs", href: "#docs" },
  { label: "GitHub", href: "https://github.com/wildchain/dolores" },
  { label: "Twitter", href: "https://twitter.com/doloresprotocol" },
];

export function Footer() {
  return (
    <footer
      className="relative z-10 px-8 flex items-center justify-between h-16"
      style={{
        background: "var(--surface-raised)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {/* Left — wordmark */}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center w-5 h-5 rounded font-bold select-none"
          style={{
            fontSize: 11,
            background: "var(--fg)",
            color: "var(--fg-inverse)",
          }}
        >
          D
        </span>
        <span
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: "var(--fs-12)",
            letterSpacing: "0.1em",
            color: "var(--fg-muted)",
          }}
        >
          Dolores · Accountability on Solana
        </span>
      </div>

      {/* Right — links */}
      <nav className="flex items-center gap-6">
        {FOOTER_LINKS.map(l => (
          <Link
            key={l.label}
            href={l.href}
            className="transition-colors duration-150"
            style={{ fontSize: "var(--fs-14)", color: "var(--fg-muted)" }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)")
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
    </footer>
  );
}
