import * as crypto from "crypto";

//  Real capability templates -:

// Each template maps directly to a skill on solana.com/skills.
// The capability_hash is sha256 of the canonical manifest JSON.
// These program IDs are the actual on-chain addresses for each protocol.

export interface CapabilityManifest {
    template: string;
    version: string;
    allowed_programs: string[];
    max_transfer_usdc: number;
    description: string;
    skill_ref: string; // github URL of the source SKILL.md
}

export const CAPABILITY_TEMPLATES: Record<string, CapabilityManifest> = {
    JUPITER_TRADER: {
        template: "JUPITER_TRADER",
        version: "1.0.0",
        allowed_programs: [
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6 aggregator
            "jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi", // Jupiter Lend — borrow
            "jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9",  // Jupiter Lend — earn
            "LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn",  // Jupiter Lock (vesting)
        ],
        max_transfer_usdc: 50_000,
        description: "Jupiter swaps, limit orders, DCA, lending, and lock",
        skill_ref: "https://github.com/jup-ag/agent-skills/tree/35f50e9/skills/integrating-jupiter",
    },

    RAYDIUM_LP: {
        template: "RAYDIUM_LP",
        version: "1.0.0",
        allowed_programs: [
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM v4
            "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
            "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Raydium CPMM
        ],
        max_transfer_usdc: 50_000,
        description: "Raydium AMM, CLMM, CPMM pools and farming",
        skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/raydium",
    },

    ORCA_WHIRLPOOL: {
        template: "ORCA_WHIRLPOOL",
        version: "1.0.0",
        allowed_programs: [
            "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpools
        ],
        max_transfer_usdc: 50_000,
        description: "Orca Whirlpools concentrated liquidity — swaps and position management",
        skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/orca",
    },

    KAMINO_LENDING: {
        template: "KAMINO_LENDING",
        version: "1.0.0",
        allowed_programs: [
            "KLend2g3cP87fffoy8q1mQqGKjrL983YkuhRvKCLM7k",  // Kamino Lending
            "6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc", // Kamino Liquidity
        ],
        max_transfer_usdc: 50_000,
        description: "Kamino lending, borrowing, liquidity management — no borrow instructions",
        skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/kamino",
    },

    METEORA_POOLS: {
        template: "METEORA_POOLS",
        version: "1.0.0",
        allowed_programs: [
            "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkAW7vAo", // Meteora DLMM
            "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  // Meteora LB Clmm
            "M3mxk5W2tt27WGT7THox7PmgRDp4m6NEhL5xvxkFz5",   // Meteora AMM pools
        ],
        max_transfer_usdc: 50_000,
        description: "Meteora liquidity pools, AMMs, and bonding curves",
        skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/meteora",
    },

    PYTH_ORACLE_READER: {
        template: "PYTH_ORACLE_READER",
        version: "1.0.0",
        allowed_programs: [
            "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ", // Pyth oracle receiver
            "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE", // Pyth push oracle
        ],
        max_transfer_usdc: 0, // read-only, no transfers
        description: "Pyth Network price feeds — read-only, zero write instructions",
        skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/pyth",
    },
};

//  Hash a manifest to a 32-byte capability_hash 
// Keys are sorted alphabetically for determinism — same manifest
// always produces the same hash regardless of insertion order.

export function hashManifest(manifest: CapabilityManifest): Buffer {
    const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
    return crypto.createHash("sha256").update(canonical).digest();
}

//  CLI display helpers 

export function templateChoices(): string {
    return Object.entries(CAPABILITY_TEMPLATES)
        .map(([key, m], i) => `  ${i + 1}. ${key.padEnd(22)} — ${m.description}`)
        .join("\n");
}

export function templateByIndex(index: number): [string, CapabilityManifest] | null {
    const entries = Object.entries(CAPABILITY_TEMPLATES);
    const entry = entries[index - 1];
    return entry ?? null;
}