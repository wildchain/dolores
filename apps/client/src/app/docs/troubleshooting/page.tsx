import { DocsSection } from "@/components/docs/DocsSection";
import { CodeBlock } from "@/components/docs/CodeBlock";

const ISSUES = [
    {
        title: "Wallet not found",
        description:
            "No Solana keypair exists at the expected path.",
        fix: `solana-keygen new --outfile ~/.config/solana/id.json`,
    },

    {
        title: "Insufficient SOL balance",
        description:
            "Your wallet doesn't have enough SOL for fees or staking.",
        fix: `solana airdrop 2 --url devnet`,
    },

    {
        title: "MCP server not visible in Claude",
        description:
            "Claude configuration is invalid or Claude wasn't restarted.",
        fix: `Restart Claude after updating ~/.claude.json`,
    },

    {
        title: "Agent task stuck in pending",
        description:
            "Network congestion or inactive agent.",
        fix: `Call dolores_task_status again after 1 minute`,
    },

    {
        title: "npx dolores-mcp version conflicts",
        description:
            "Cached or outdated package versions.",
        fix: `npx dolores-mcp@latest`,
    },
];

export default function TroubleshootingPage() {
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
                    Troubleshooting
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
                    Common issues
                </h1>

                <p
                    className="max-w-3xl"
                    style={{
                        fontSize: "var(--fs-20)",
                        lineHeight: 1.8,
                        color: "var(--fg-muted)",
                    }}
                >
                    Fix common installation, wallet,
                    and MCP configuration problems.
                </p>
            </div>

            {ISSUES.map(issue => (
                <DocsSection
                    key={issue.title}
                    title={issue.title}
                >
                    <p>{issue.description}</p>

                    <CodeBlock>
                        {issue.fix}
                    </CodeBlock>
                </DocsSection>
            ))}
        </div>
    );
}