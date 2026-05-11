import { DocsSection } from "@/components/docs/DocsSection";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout } from "@/components/docs/DocsCallout";

export default function QuickStartPage() {
    return (
        <div>
            <div className="mb-20">
                <div
                    className="mb-5"
                    style={{
                        color: "var(--accent)",
                        fontSize: "var(--fs-14)",
                        fontWeight: 600,
                    }}
                >
                    Quick Start
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
                    Get your first
                    <br />
                    agent running.
                </h1>

                <p
                    className="max-w-3xl"
                    style={{
                        fontSize: "var(--fs-20)",
                        lineHeight: 1.8,
                        color: "var(--fg-muted)",
                    }}
                >
                    Create, stake, and assign tasks to an AI agent
                    in under 5 minutes.
                </p>
            </div>

            <DocsSection title="Step 1 — Open Claude Code">
                <p>
                    Launch Claude Code from your terminal.
                </p>

                <CodeBlock>
                    {`code claude`}
                </CodeBlock>

                <DocsCallout>
                    Make sure Dolores MCP has already been
                    installed and registered in Claude.
                </DocsCallout>
            </DocsSection>

            <DocsSection title="Step 2 — Verify Setup">
                <p>
                    Confirm your wallet and Dolores setup
                    are working correctly.
                </p>

                <CodeBlock>
                    {`Check my Dolores wallet setup`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Step 3 — Register Agent">
                <p>
                    Create your first AI agent using a
                    predefined capability template.
                </p>

                <CodeBlock>
                    {`Register a new agent named "MySwapper"
using the JUPITER_TRADER template`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Step 4 — Stake SOL">
                <p>
                    Stake SOL on the agent to establish
                    accountability and reputation.
                </p>

                <CodeBlock>
                    {`Stake 0.5 SOL on my MySwapper agent`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Step 5 — Assign Task">
                <p>
                    Give the agent a natural language
                    instruction to execute.
                </p>

                <CodeBlock>
                    {`Tell MySwapper to swap 0.1 SOL for USDC`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Step 6 — Check Status">
                <p>
                    Monitor the execution status of
                    the assigned task.
                </p>

                <CodeBlock>
                    {`What's the status of the swap task?`}
                </CodeBlock>
            </DocsSection>
        </div>
    );
}