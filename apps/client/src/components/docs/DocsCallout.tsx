"use client";

export function DocsCallout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="rounded-2xl p-6"
            style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid var(--border-subtle)",
                borderLeft: "3px solid var(--accent)",
                boxShadow: "var(--shadow-sm)",
            }}
        >
            <div
                style={{
                    color: "var(--fg)",
                    fontSize: "var(--fs-16)",
                    lineHeight: 1.8,
                    fontWeight: 500,
                }}
            >
                {children}
            </div>
        </div>
    );
}