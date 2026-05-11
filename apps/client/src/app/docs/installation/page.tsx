import { DocsSection } from "@/components/docs/DocsSection";
import { DocsTable } from "@/components/docs/DocsTable";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout } from "@/components/docs/DocsCallout";

export default function InstallationPage() {
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
                    Installation
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
                    Install Dolores MCP
                </h1>

                <p
                    className="max-w-3xl"
                    style={{
                        fontSize: "var(--fs-20)",
                        lineHeight: 1.8,
                        color: "var(--fg-muted)",
                    }}
                >
                    Configure Dolores MCP locally and connect Claude
                    to Solana-native AI agent infrastructure.
                </p>
            </div>

            <DocsSection title="Prerequisites">
                <DocsTable
                    headers={[
                        "Requirement",
                        "Version",
                        "Notes",
                    ]}
                    rows={[
                        [
                            "Node.js",
                            ">= 18.x",
                            "Required to run the MCP server",
                        ],
                        [
                            "npm / npx",
                            ">= 9.x",
                            "Used to install or run Dolores",
                        ],
                        [
                            "Claude Code CLI",
                            "Latest",
                            "MCP-compatible client",
                        ],
                        [
                            "Solana CLI",
                            ">= 1.18",
                            "Wallet management",
                        ],
                        [
                            "Solana Wallet",
                            "-",
                            "Keypair at ~/.config/solana/id.json",
                        ],
                    ]}
                />
            </DocsSection>

            <DocsSection title="Solana Wallet Setup">
                <p>
                    If you don't already have a Solana wallet,
                    generate one locally using the Solana CLI.
                </p>

                <CodeBlock>
                    {`# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate wallet
solana-keygen new

# View wallet address
solana address

# Fund devnet wallet
solana airdrop 2 --url devnet`}
                </CodeBlock>

                <DocsCallout>
                    You need SOL in your wallet to pay for
                    transaction fees, staking, and agent hire fees.
                </DocsCallout>
            </DocsSection>

            <DocsSection title="Recommended Installation">
                <p>
                    Install and register Dolores MCP directly
                    into Claude using a single command.
                </p>

                <CodeBlock>
                    {`claude mcp add dolores npx dolores-mcp@latest --scope user`}
                </CodeBlock>

                <DocsCallout>
                    This command automatically:
                    <br />
                    • installs Dolores MCP
                    <br />
                    • registers the MCP server in Claude
                    <br />
                    • updates ~/.claude.json
                    <br />
                    • enables Dolores tools instantly
                </DocsCallout>
            </DocsSection>

            <DocsSection title="Global Install">
                <CodeBlock>
                    npm install -g dolores-mcp
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Configure Claude">
                <p>
                    Add Dolores MCP to your Claude configuration
                    file located at:
                </p>

                <CodeBlock>
                    ~/.claude.json
                </CodeBlock>

                <CodeBlock title="json">
                    {`{
  "mcpServers": {
    "dolores": {
      "type": "stdio",
      "command": "npx",
      "args": ["dolores-mcp@latest"],
      "env": {}
    }
  }
}`}
                </CodeBlock>
            </DocsSection>

            <DocsSection title="Verify Setup">
                <p>
                    Restart Claude and run the following command:
                </p>

                <CodeBlock>
                    dolores_setup
                </CodeBlock>

                <p>
                    Dolores will verify your wallet connection
                    and display your SOL balance.
                </p>
            </DocsSection>
        </div>
    );
}