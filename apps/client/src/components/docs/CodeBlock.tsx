"use client";

import { useState } from "react";

export function CodeBlock({
    children,
    title = "bash",
}: {
    children: React.ReactNode;
    title?: string;
}) {
    const [copied, setCopied] = useState(false);

    const content =
        typeof children === "string"
            ? children
            : String(children);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <div
            className="overflow-hidden rounded-2xl"
            style={{
                background: "var(--navy)",
                border: "1px solid rgba(215,239,255,0.08)",
                boxShadow: "var(--shadow-lg)",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3"
                style={{
                    borderBottom:
                        "1px solid rgba(215,239,255,0.07)",
                    background: "rgba(0,0,0,0.22)",
                }}
            >
                <span
                    className="uppercase"
                    style={{
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        color: "rgba(215,239,255,0.4)",
                        fontWeight: 700,
                    }}
                >
                    {title}
                </span>

                <button
                    onClick={handleCopy}
                    className="transition-opacity hover:opacity-80"
                    style={{
                        fontSize: 11,
                        color: copied
                            ? "#67e8f9"
                            : "rgba(215,239,255,0.4)",
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    {copied ? "COPIED" : "COPY"}
                </button>
            </div>

            {/* Content */}
            <pre
                className="overflow-x-auto p-5"
                style={{
                    fontSize: "var(--fs-14)",
                    lineHeight: 1.9,
                    color: "var(--primary)",
                }}
            >
                <code>{children}</code>
            </pre>
        </div>
    );
}