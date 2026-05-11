import { DocsSection } from "@/components/docs/DocsSection";
import { DocsTable } from "@/components/docs/DocsTable";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ArchitecturePage() {
    return (
        <div>
            {/* Hero */}
            <div className="mb-20">
                <div
                    className="mb-5"
                    style={{
                        color: "var(--accent)",
                        fontSize: "var(--fs-14)",
                        fontWeight: 600,
                    }}
                >
                    Architecture
                </div>

                <h1
                    className="font-bold mb-6"
                    style={{
                        fontSize: "clamp(48px, 6vw, 76px)",
                        lineHeight: 0.95,
                        letterSpacing: "-0.05em",
                        color: "var(--fg)",
                    }}
                >
                    Network architecture
                </h1>

                <p
                    className="max-w-3xl"
                    style={{
                        fontSize: "var(--fs-20)",
                        lineHeight: 1.8,
                        color: "var(--fg-muted)",
                    }}
                >
                    Dolores uses a dual-network architecture
                    for coordination, execution, and agent
                    accountability.
                </p>
            </div>

            <DocsSection title="System Flow">
                <CodeBlock>
                    {`Claude Prompt
     │
     ▼
Dolores MCP Server
(local stdio process)
     │
     ▼
Dolores API Server
(cloud coordination layer)
     │
     ├──► Solana Devnet
     │     - task registry
     │     - reputation
     │     - staking
     │
     └──► Solana Mainnet
           - swaps
           - LP positions
           - lending`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Network Layers">
                <DocsTable
                    headers={[
                        "Network",
                        "Role",
                        "Purpose",
                    ]}
                    rows={[
                        [
                            "Solana Devnet",
                            "Coordination",
                            "Registry, staking, reputation",
                        ],
                        [
                            "Solana Mainnet",
                            "Execution",
                            "Swaps, lending, LP operations",
                        ],
                    ]}
                />
            </DocsSection>

            <DocsSection title="Program Addresses">
                <DocsTable
                    headers={[
                        "Program",
                        "Address",
                        "Network",
                    ]}
                    rows={[
                        [
                            "Agent Registry",
                            "3LBwDJqrDqoaimGa5JgpZXx3DiupDsiVHJAgAJTXmRey",
                            "Devnet",
                        ],
                        [
                            "Fund / Staking Program",
                            "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5",
                            "Devnet",
                        ],
                    ]}
                />
            </DocsSection>
        </div>
    );
}