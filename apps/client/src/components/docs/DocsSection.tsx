"use client";

export function DocsSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-20">
            <h2
                className="font-bold mb-8"
                style={{
                    fontSize: "42px",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    color: "var(--fg)",
                }}
            >
                {title}
            </h2>

            <div
                className="space-y-6"
                style={{
                    color: "var(--fg-muted)",
                    fontSize: "var(--fs-18)",
                    lineHeight: 1.75,
                }}
            >
                {children}
            </div>
        </section>
    );
}