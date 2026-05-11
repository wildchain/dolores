"use client";

export function DocsTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: string[][];
}) {
    return (
        <div
            className="overflow-hidden rounded-2xl"
            style={{
                border: "1px solid rgba(148,163,184,0.12)",
            }}
        >
            <table className="w-full">
                <thead
                    style={{
                        background: "rgba(255,255,255,0.03)",
                    }}
                >
                    <tr>
                        {headers.map(h => (
                            <th
                                key={h}
                                className="text-left px-5 py-4"
                                style={{
                                    fontSize: 13,
                                    color: "var(--accent)",
                                    fontWeight: 600,
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={i}
                            style={{
                                borderTop:
                                    "1px solid rgba(148,163,184,0.08)",
                            }}
                        >
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="px-5 py-4"
                                    style={{
                                        color: "var(--fg-muted)",
                                        fontSize: 15,
                                        lineHeight: 1.7,
                                    }}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}