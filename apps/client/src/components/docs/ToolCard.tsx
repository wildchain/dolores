"use client";

import { CodeBlock } from "./CodeBlock";

type Param = {
    name: string;
    type: string;
    required: boolean;
    description: string;
};

type Props = {
    name: string;
    description: string;
    parameters?: Param[];
    returns?: string;
    example?: string;
};

export function ToolCard({
    name,
    description,
    parameters,
    returns,
    example,
}: Props) {
    return (
        <div
            className="rounded-3xl p-8 mb-10"
            style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
            }}
        >
            {/* Header */}
            <div className="mb-6">
                <div
                    className="inline-flex items-center rounded-lg px-3 py-1 mb-4"
                    style={{
                        background: "var(--primary-subtle)",
                        border: "1px solid var(--primary)",
                        color: "var(--accent)",
                        fontSize: "var(--fs-13)",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    {name}
                </div>

                <p
                    style={{
                        color: "var(--fg-muted)",
                        fontSize: "var(--fs-17)",
                        lineHeight: 1.8,
                    }}
                >
                    {description}
                </p>
            </div>

            {/* Parameters */}
            {parameters && parameters.length > 0 && (
                <div className="mb-8">
                    <h3
                        className="font-semibold mb-4"
                        style={{
                            fontSize: "var(--fs-20)",
                            color: "var(--fg)",
                        }}
                    >
                        Parameters
                    </h3>

                    <div
                        className="overflow-hidden rounded-2xl"
                        style={{
                            border: "1px solid var(--border-subtle)",
                        }}
                    >
                        <table className="w-full">
                            <thead
                                style={{
                                    background: "rgba(255,255,255,0.55)",
                                }}
                            >
                                <tr>
                                    <th className="text-left px-5 py-4 text-sm">
                                        Name
                                    </th>

                                    <th className="text-left px-5 py-4 text-sm">
                                        Type
                                    </th>

                                    <th className="text-left px-5 py-4 text-sm">
                                        Required
                                    </th>

                                    <th className="text-left px-5 py-4 text-sm">
                                        Description
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {parameters.map(param => (
                                    <tr
                                        key={param.name}
                                        style={{
                                            borderTop:
                                                "1px solid var(--border-subtle)",
                                        }}
                                    >
                                        <td
                                            className="px-5 py-4"
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "14px",
                                                color: "var(--accent)",
                                            }}
                                        >
                                            {param.name}
                                        </td>

                                        <td
                                            className="px-5 py-4"
                                            style={{
                                                color: "var(--fg-muted)",
                                            }}
                                        >
                                            {param.type}
                                        </td>

                                        <td
                                            className="px-5 py-4"
                                            style={{
                                                color: param.required
                                                    ? "#DC2626"
                                                    : "var(--fg-muted)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {param.required ? "Yes" : "No"}
                                        </td>

                                        <td
                                            className="px-5 py-4"
                                            style={{
                                                color: "var(--fg-muted)",
                                                lineHeight: 1.7,
                                            }}
                                        >
                                            {param.description}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Returns */}
            {returns && (
                <div className="mb-8">
                    <h3
                        className="font-semibold mb-3"
                        style={{
                            fontSize: "var(--fs-20)",
                            color: "var(--fg)",
                        }}
                    >
                        Returns
                    </h3>

                    <p
                        style={{
                            color: "var(--fg-muted)",
                            lineHeight: 1.8,
                        }}
                    >
                        {returns}
                    </p>
                </div>
            )}

            {/* Example */}
            {example && (
                <div>
                    <h3
                        className="font-semibold mb-4"
                        style={{
                            fontSize: "var(--fs-20)",
                            color: "var(--fg)",
                        }}
                    >
                        Example Prompt
                    </h3>

                    <CodeBlock>
                        {example}
                    </CodeBlock>
                </div>
            )}
        </div>
    );
}