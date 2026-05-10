"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
    {
        label: "Overview",
        href: "/docs",
    },
    {
        label: "Installation",
        href: "/docs/installation",
    },
    {
        label: "Quick Start",
        href: "/docs/quick-start",
    },
    {
        label: "Available Tools",
        href: "/docs/tools",
    },
    {
        label: "Examples",
        href: "/docs/examples",
    },
    {
        label: "Architecture",
        href: "/docs/architecture",
    },
    {
        label: "Troubleshooting",
        href: "/docs/troubleshooting",
    },
];

export function DocsSidebar() {
    const pathname = usePathname();

    return (
        <aside
            className="sticky top-0 h-screen w-[290px] shrink-0 border-r"
            style={{
                borderColor: "var(--border-subtle)",
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
            }}
        >
            <div className="p-6">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-3 mb-10"
                >
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                        style={{
                            background: "var(--fg)",
                            color: "var(--fg-inverse)",
                        }}
                    >
                        D
                    </div>

                    <div>
                        <div
                            className="font-semibold"
                            style={{
                                color: "var(--fg)",
                                fontSize: "var(--fs-18)",
                            }}
                        >
                            Dolores
                        </div>

                        <div
                            style={{
                                color: "var(--fg-muted)",
                                fontSize: "var(--fs-12)",
                            }}
                        >
                            Developer Docs
                        </div>
                    </div>
                </Link>

                {/* Section label */}
                <div
                    className="mb-3 uppercase"
                    style={{
                        color: "var(--fg-muted)",
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                    }}
                >
                    Reference
                </div>

                {/* Nav */}
                <nav className="space-y-1">
                    {ITEMS.map(item => {
                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="
    block
    px-3
    py-2
    rounded-lg
    transition-all
    duration-150
    hover:translate-x-[2px]
  "
                                style={{
                                    background: active
                                        ? "var(--primary-subtle)"
                                        : "rgba(255,255,255,0)",

                                    color: active
                                        ? "var(--accent)"
                                        : "var(--fg-muted)",

                                    border: active
                                        ? "1px solid var(--primary)"
                                        : "1px solid transparent",

                                    fontSize: "var(--fs-14)",
                                    fontWeight: active ? 600 : 500,
                                    cursor: "pointer",
                                }}
                                onMouseEnter={e => {
                                    if (!active) {
                                        e.currentTarget.style.background =
                                            "rgba(255,255,255,0.5)";
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!active) {
                                        e.currentTarget.style.background =
                                            "rgba(255,255,255,0)";
                                    }
                                }}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Version card */}
                <div
                    className="mt-10 rounded-2xl p-4"
                    style={{
                        background: "rgba(255,255,255,0.55)",
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div
                        className="uppercase mb-2"
                        style={{
                            color: "var(--fg-muted)",
                            fontSize: "11px",
                            letterSpacing: "0.08em",
                            fontWeight: 700,
                        }}
                    >
                        Version
                    </div>

                    <div
                        className="font-semibold"
                        style={{
                            color: "var(--accent)",
                            fontSize: "var(--fs-18)",
                        }}
                    >
                        0.1.18
                    </div>

                    <div
                        style={{
                            color: "var(--fg-muted)",
                            fontSize: "var(--fs-12)",
                        }}
                    >
                        Dolores-mcp
                    </div>
                </div>
            </div>
        </aside >
    );
}