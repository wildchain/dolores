"use client";

import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-screen relative"
            style={{
                background: "var(--bg)",
                color: "var(--fg)",
            }}
        >
            {/* Ambient gradient */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: "var(--ambient-light)",
                    zIndex: 0,
                }}
            />

            <div className="relative z-10 flex">
                {/* Sidebar */}
                <DocsSidebar />

                {/* Main */}
                <main className="flex-1 min-w-0">
                    <div className="max-w-6xl px-16 xl:px-20 py-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}