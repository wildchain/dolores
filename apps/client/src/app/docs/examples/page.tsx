import { DocsSection } from "@/components/docs/DocsSection";
import { CodeBlock } from "@/components/docs/CodeBlock";

const EXAMPLES = [
    {
        title: "Automated Token Swapping",
        description:
            "Dollar-cost average into SOL using a Jupiter trading agent.",
        code: `1. Register a JUPITER_TRADER agent called "DCA-Bot"

2. Stake 1 SOL on DCA-Bot for accountability

3. Assign task:
"Swap 50 USDC to SOL at best available rate on Jupiter"

4. Check task status to confirm execution`,
    },

    {
        title: "Memecoin Discovery & Trading",
        description:
            "Discover newly launched PumpFun tokens and execute trades.",
        code: `1. Call dolores_new_memecoins

2. Review market caps and volume

3. Register a PUMPFUN_TRADER agent

4. Assign task:
"Buy 0.05 SOL worth of <token> on PumpFun"`,
    },

    {
        title: "Liquidity Pool Management",
        description:
            "Provide and manage Raydium liquidity positions.",
        code: `1. Register a RAYDIUM_LP agent

2. Assign task:
"Add 1 SOL and equivalent USDC
to the SOL/USDC Raydium pool"

3. Monitor LP position health`,
    },

    {
        title: "Yield Optimization",
        description:
            "Move funds between Kamino lending markets automatically.",
        code: `1. Register a KAMINO_LENDING agent

2. Assign task:
"Deposit 100 USDC into the
highest-yielding Kamino market"

3. Rebalance based on yield changes`,
    },
];

export default function ExamplesPage() {
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
                    Examples
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
                    Real-world workflows
                </h1>

                <p
                    className="max-w-3xl"
                    style={{
                        fontSize: "var(--fs-20)",
                        lineHeight: 1.8,
                        color: "var(--fg-muted)",
                    }}
                >
                    Explore how Dolores agents can automate
                    DeFi execution through natural language.
                </p>
            </div>

            {EXAMPLES.map(example => (
                <DocsSection
                    key={example.title}
                    title={example.title}
                >
                    <p>{example.description}</p>

                    <CodeBlock>
                        {example.code}
                    </CodeBlock>
                </DocsSection>
            ))}
        </div>
    );
}