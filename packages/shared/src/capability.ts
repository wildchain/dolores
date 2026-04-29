// ─── Solana base program constants ───────────────────────────────────────────
// These programs are present in virtually every Solana transaction and must be
// included in allowed_programs for the indexer's whitelist check to pass.

export const SOLANA_BASE_PROGRAMS = [
  "11111111111111111111111111111111", // System Program — SOL transfers & account creation
  "ComputeBudget111111111111111111111111111111", // Compute Budget — priority fees, CU limits
] as const;

// Required by any transaction that creates or moves SPL tokens.
export const SOLANA_TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token Extensions (Token-2022)
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bS8", // Associated Token Account
] as const;

// ─── Capability template IDs ──────────────────────────────────────────────────

export const CAPABILITY_TEMPLATE_IDS = {
  SOL_TRANSFER: "SOL_TRANSFER",
  JUPITER_TRADER: "JUPITER_TRADER",
  RAYDIUM_LP: "RAYDIUM_LP",
  ORCA_WHIRLPOOL: "ORCA_WHIRLPOOL",
  KAMINO_LENDING: "KAMINO_LENDING",
  METEORA_POOLS: "METEORA_POOLS",
  PYTH_ORACLE_READER: "PYTH_ORACLE_READER",
} as const;

export type CapabilityTemplateId =
  (typeof CAPABILITY_TEMPLATE_IDS)[keyof typeof CAPABILITY_TEMPLATE_IDS];

// ─── Manifest types ───────────────────────────────────────────────────────────

export interface AllowedOperation {
  operation_type: string;
  // Relative path within the schemas/operations directory, or a content-addressed URL.
  schema_ref: string;
  constraints: Record<string, unknown>;
}

export interface GlobalConstraints {
  max_single_transaction_usdc: number;
  require_deadline: boolean;
  max_total_exposure_usdc?: number;
}

/**
 * Canonical on-chain capability commitment.
 *
 * The SHA-256 of the deterministically serialised manifest is stored as
 * `capability_hash: [u8; 32]` in the Dolores registry program. Any change to
 * any field produces a different hash, invalidating existing registrations.
 */
export interface CapabilityManifest {
  template_id: CapabilityTemplateId;
  version: string;
  description: string;
  /** URL pointing to the source SKILL.md / specification for this capability. */
  skill_ref: string;
  /**
   * Exhaustive list of Solana program IDs the agent may invoke.
   * Must include SOLANA_BASE_PROGRAMS (and SOLANA_TOKEN_PROGRAMS for any
   * template that moves tokens) so the indexer's whitelist check passes.
   */
  allowed_programs: string[];
  /**
   * Per-operation-type constraints and JSON Schema references.
   * Populated as [] for templates not yet fully specified.
   */
  allowed_operations: AllowedOperation[];
  global_constraints: GlobalConstraints;
}

// ─── Canonical template definitions ──────────────────────────────────────────

const BASE = [...SOLANA_BASE_PROGRAMS];
const TOKEN = [...SOLANA_TOKEN_PROGRAMS];

export const CAPABILITY_TEMPLATES: Record<
  CapabilityTemplateId,
  CapabilityManifest
> = {
  SOL_TRANSFER: {
    template_id: "SOL_TRANSFER",
    version: "1.0.0",
    description: "Native SOL transfers via System Program",
    skill_ref: "https://solana.com/docs/core/transactions",
    allowed_programs: [...BASE],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 0,
      require_deadline: false,
    },
  },

  JUPITER_TRADER: {
    template_id: "JUPITER_TRADER",
    version: "1.0.0",
    description: "Jupiter swaps, limit orders, DCA, lending, and lock",
    skill_ref:
      "https://github.com/jup-ag/agent-skills/tree/35f50e9/skills/integrating-jupiter",
    allowed_programs: [
      ...BASE,
      ...TOKEN,
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6 aggregator
      "jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi", // Jupiter Lend — borrow
      "jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9", // Jupiter Lend — earn
      "LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn", // Jupiter Lock (vesting)
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 50_000,
      require_deadline: false,
    },
  },

  RAYDIUM_LP: {
    template_id: "RAYDIUM_LP",
    version: "1.0.0",
    description: "Raydium AMM, CLMM, CPMM pools and farming",
    skill_ref:
      "https://github.com/sendaifun/skills/tree/72ef2aa/skills/raydium",
    allowed_programs: [
      ...BASE,
      ...TOKEN,
      "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM v4
      "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
      "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Raydium CPMM
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 50_000,
      require_deadline: false,
    },
  },

  ORCA_WHIRLPOOL: {
    template_id: "ORCA_WHIRLPOOL",
    version: "1.0.0",
    description:
      "Orca Whirlpools concentrated liquidity — swaps and position management",
    skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/orca",
    allowed_programs: [
      ...BASE,
      ...TOKEN,
      "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpools
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 50_000,
      require_deadline: false,
    },
  },

  KAMINO_LENDING: {
    template_id: "KAMINO_LENDING",
    version: "1.0.0",
    description:
      "Kamino lending, borrowing, liquidity management — no borrow instructions",
    skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/kamino",
    allowed_programs: [
      ...BASE,
      ...TOKEN,
      "KLend2g3cP87fffoy8q1mQqGKjrL983YkuhRvKCLM7k", // Kamino Lending
      "6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc", // Kamino Liquidity
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 50_000,
      require_deadline: false,
    },
  },

  METEORA_POOLS: {
    template_id: "METEORA_POOLS",
    version: "1.0.0",
    description: "Meteora liquidity pools, AMMs, and bonding curves",
    skill_ref:
      "https://github.com/sendaifun/skills/tree/72ef2aa/skills/meteora",
    allowed_programs: [
      ...BASE,
      ...TOKEN,
      "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkAW7vAo", // Meteora DLMM
      "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", // Meteora LB Clmm
      "M3mxk5W2tt27WGT7THox7PmgRDp4m6NEhL5xvxkFz5", // Meteora AMM pools
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 50_000,
      require_deadline: false,
    },
  },

  PYTH_ORACLE_READER: {
    template_id: "PYTH_ORACLE_READER",
    version: "1.0.0",
    description:
      "Pyth Network price feeds — read-only, zero write instructions",
    skill_ref: "https://github.com/sendaifun/skills/tree/72ef2aa/skills/pyth",
    allowed_programs: [
      ...BASE,
      "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ", // Pyth oracle receiver
      "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE", // Pyth push oracle
    ],
    allowed_operations: [],
    global_constraints: {
      max_single_transaction_usdc: 0,
      require_deadline: false,
    },
  },
};

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Recursively sorts object keys alphabetically so the JSON serialisation is
 * deterministic regardless of insertion order, including nested objects.
 */
function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortedValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 of the canonically serialised manifest → 32-byte number[].
 *
 * Uses the Web Crypto API (available in Node ≥18 and all modern browsers)
 * so this function works in both the CLI and the client without separate
 * Node/browser code paths.
 */
export async function hashManifest(
  manifest: CapabilityManifest,
): Promise<number[]> {
  const json = JSON.stringify(sortedValue(manifest));
  const encoded = new TextEncoder().encode(json);
  const buf = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoded.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(buf));
}
