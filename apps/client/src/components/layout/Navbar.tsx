"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/data";
import { WalletButton } from "@/components/ui/WalletButton";

const LINKS = [
  { href: "/explorer", label: "Explorer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/staker", label: "Staker" },
  { href: "/register", label: "Register" },
];

export function Navbar() {
  const path = usePathname();
  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-8 h-14"
      style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Link
        href="/explorer"
        className="font-bold"
        style={{
          fontSize: "var(--fs-20)",
          letterSpacing: "-0.02em",
          background:
            "linear-gradient(135deg, var(--fg) 0%, var(--accent) 120%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Dolores
      </Link>

      <div className="flex items-center gap-0.5">
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "px-3.5 py-1.5 font-medium transition-colors duration-150",
              path === l.href
                ? "rounded-[var(--radius-sm)]"
                : "rounded-[var(--radius-sm)]",
            )}
            style={{
              fontSize: "var(--fs-14)",
              ...(path === l.href
                ? {
                    background: "var(--primary-subtle)",
                    color: "var(--accent)",
                    border: "1px solid var(--primary)",
                  }
                : {
                    color: "var(--fg-muted)",
                    border: "1px solid transparent",
                  }),
            }}
            onMouseEnter={e => {
              if (path !== l.href) {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = "var(--fg)";
                el.style.background = "var(--bg)";
              }
            }}
            onMouseLeave={e => {
              if (path !== l.href) {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = "var(--fg-muted)";
                el.style.background = "";
              }
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "var(--fs-12)",
            color: "var(--fg-subtle)",
            border: "1px solid var(--border-subtle)",
            padding: "3px 10px",
            borderRadius: "999px",
            background: "var(--bg)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          devnet
        </span>
        <WalletButton />
      </div>
    </nav>
  );
}
