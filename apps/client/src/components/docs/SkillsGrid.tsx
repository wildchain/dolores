"use client";

const SKILLS = [
    {
        name: "JUPITER_TRADER",
        protocol: "Jupiter Aggregator",
        description: "Best-price token swaps",
    },
    {
        name: "PUMPFUN_TRADER",
        protocol: "PumpFun",
        description: "Memecoin trading",
    },
    {
        name: "RAYDIUM_LP",
        protocol: "Raydium",
        description: "Yield farming & LP management",
    },
    {
        name: "METEORA_POOLS",
        protocol: "Meteora DLMM",
        description: "Advanced LP strategies",
    },
    {
        name: "KAMINO_LENDING",
        protocol: "Kamino",
        description: "Yield optimization & leverage",
    },
    {
        name: "PYTH_ORACLE_READER",
        protocol: "Pyth Network",
        description: "Price feeds & monitoring",
    },
    {
        name: "SOL_TRANSFER",
        protocol: "Native Solana",
        description: "Treasury & wallet transfers",
    },
];

export function SkillsGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SKILLS.map(skill => (
                <div
                    key={skill.name}
                    className="rounded-3xl p-6 transition-all duration-200 hover:-translate-y-[2px]"
                    style={{
                        background: "rgba(255,255,255,0.72)",
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    {/* Skill Name */}
                    <div
                        className="inline-flex items-center rounded-lg px-3 py-1 mb-4"
                        style={{
                            background: "var(--primary-subtle)",
                            border: "1px solid var(--primary)",
                            color: "var(--accent)",
                            fontSize: "12px",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        {skill.name}
                    </div>

                    {/* Protocol */}
                    <h3
                        className="font-semibold mb-2"
                        style={{
                            color: "var(--fg)",
                            fontSize: "20px",
                        }}
                    >
                        {skill.protocol}
                    </h3>

                    {/* Description */}
                    <p
                        style={{
                            color: "var(--fg-muted)",
                            lineHeight: 1.7,
                            fontSize: "15px",
                        }}
                    >
                        {skill.description}
                    </p>
                </div>
            ))}
        </div>
    );
}