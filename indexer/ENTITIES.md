# Dolores Entity Reference

Complete reference of all entities in the CLU/Dolores system — on-chain (Solana PDAs), off-chain (indexer database), and data structures.

---

## On-Chain Entities (Solana PDAs)

### 1. ReputationRecord (Registry PDA)

**Program:** `clu_registry`  
**Seeds:** `["agent_registry", agent.key()]`  
**Purpose:** Agent identity and reputation state — the source of truth for trust decisions

```rust
pub struct ReputationRecord {
    pub agent_id:           Pubkey,    // Agent wallet address
    pub operator:           Pubkey,    // Who registered the agent
    pub capability_hash:    [u8; 32],  // SHA256 of capability manifest (immutable)
    pub reputation_score:   u64,       // 0–10000 (0–100.00%)
    pub slash_count:        u8,        // Permanent slash counter
    pub total_attestations: u64,       // Lifetime attestation count
    pub total_tasks:        u64,       // Lifetime task count
    pub arweave_cid:        String,    // Arweave txid pointer to full history
    pub registered_at:      i64,       // Registration timestamp
    pub last_updated:       i64,       // Last reputation update
    pub bump:               u8,        // PDA bump seed
}
```

**Key Operations:**

- `register_agent()` — Creates with dual signature (operator + agent)
- `submit_attestation()` — Updates reputation after task completion
- `verify_agent()` — CPI-callable trust check (composability primitive)
- `write_arweave_cid()` — Anchors reputation snapshot CID

**Why it exists:** External protocols call `verify_agent()` via CPI before granting access to resources (liquidity pools, API keys, task queues). One PDA per agent, optimized for read-heavy access.

---

### 2. FundAccount (Fund PDA)

**Program:** `clu_fund`  
**Seeds:** `["fund_account", operator.key(), agent_id.key()]`  
**Purpose:** Manages economic stake at risk — skin in the game for accountability

```rust
pub struct FundAccount {
    pub operator:            Pubkey,    // Validator who created the fund
    pub agent_id:            Pubkey,    // Which agent this fund backs
    pub validator:           Pubkey,    // Validator wallet (redundant but explicit)
    pub total_locked_stake:  u64,       // Sum of all staked USDC (6 decimals)
    pub validator_stake:     u64,       // Validator's own stake
    pub community_stake:     u64,       // Sum of community staker positions
    pub stake_token_mint:    Pubkey,    // USDC mint address
    pub staker_count:        u16,       // Number of community stakers
    pub bump:                u8,        // PDA bump seed
}
```

**Key Operations:**

- `stake()` — Validator deposits USDC into fund
- `community_stake()` — Third-party staker deposits USDC
- `withdraw_stake()` — Only allowed if no active challenges
- `claim_rewards()` — Distribute proportional rewards to stakers

**Why it exists:** Separates economic risk (fund pool) from reputation (registry). Multiple stakers can back one agent without touching its identity record. Enables proportional reward distribution without hardcoded percentages.

---

### 3. StakerPosition PDA

**Program:** `clu_fund`  
**Seeds:** `["staker_position", fund_account.key(), staker.key()]`  
**Purpose:** Individual staker's position in a community-backed agent fund

```rust
pub struct StakerPosition {
    pub fund_account:      Pubkey,    // Which FundAccount this belongs to
    pub staker:            Pubkey,    // Staker's wallet
    pub amount_staked:     u64,       // USDC staked (6 decimals)
    pub staked_at:         i64,       // Stake creation timestamp
    pub last_claim_epoch:  u64,       // Last reward claim (7-day epochs)
    pub claimable_rewards: u64,       // Accumulated rewards ready to claim
    pub bump:              u8,        // PDA bump seed
}
```

**Key Operations:**

- Created automatically during `community_stake()`
- Updated during `claim_rewards()`
- Closed when staker withdraws full balance

**Why it exists:** Avoids account size limits from storing all stakers in `FundAccount`. Each staker owns their PDA independently — no operator signature needed to claim rewards.

---

### 4. Challenge PDA

**Program:** `clu_adjudication`  
**Seeds:** `["challenge", agent_id.key(), nonce.to_le_bytes()]`  
**Purpose:** Challenge filing and slash execution — automated accountability enforcement

```rust
pub enum FailureType {
    MissedDeadline,    // L2: provable on-chain — auto-adjudicated
    OutOfScopeCall,    // L2: provable on-chain — auto-adjudicated
    SubstantiveFailure // L3: peer validation round [post-hackathon]
}

pub struct Challenge {
    pub agent_id:     Pubkey,           // Agent being challenged
    pub task_id:      [u8; 32],         // References TaskRecord PDA
    pub challenger:   Pubkey,           // Who filed the challenge
    pub bond_amount:  u64,              // Challenger's staked bond (USDC)
    pub failure_type: FailureType,      // Challenge category
    pub proof_data:   Vec<u8>,          // Evidence (max 1KB)
    pub status:       ChallengeStatus,  // Pending | Validated | Dismissed
    pub filed_at:     i64,              // Challenge creation time
    pub nonce:        u64,              // Uniqueness seed
    pub bump:         u8,               // PDA bump seed
}
```

**Key Operations:**

- `file_challenge()` — Creates challenge, locks bond
- `auto_adjudicate()` — Resolves L2 challenges deterministically
- `execute_slash()` — Triggered on valid challenge: 60% to challenger, 40% to treasury, reputation penalty

**Why it exists:** Makes failure expensive without human judges. L2 challenges (deadline/scope violations) are fully automatic — no oracle, no committee.

---

### 5. TaskRecord PDA

**Program:** `clu_adjudication`  
**Seeds:** `["task", agent_id.key(), task_id.as_ref()]`  
**Purpose:** Ground truth for task parameters — required for challenge resolution

```rust
pub struct TaskRecord {
    pub agent_id:        Pubkey,       // Which agent is assigned
    pub task_id:         [u8; 32],     // Unique task identifier
    pub assigned_by:     Pubkey,       // User who hired the agent
    pub output_hash:     [u8; 32],     // SHA256 of execution receipt
    pub agent_signature: [u8; 64],     // Agent's signature of output_hash
    pub deadline:        i64,          // Unix timestamp deadline
    pub completed_at:    Option<i64>,  // Completion timestamp
    pub status:          TaskStatus,   // Pending | Completed | Slashed
    pub bump:            u8,           // PDA bump seed
}
```

**Key Operations:**

- `register_task()` — Called by user when hiring an agent
- Updated by agent when submitting execution receipt
- Read by `auto_adjudicate()` to verify deadline claims

**Why it exists:** Without TaskRecord, a challenger could claim "missed deadline" with no verifiable deadline to check. This PDA anchors task parameters on-chain for deterministic adjudication.

---

## Off-Chain Entities (Indexer Database)

### 6. AgentEntity (agents table)

**Database:** SQLite → PostgreSQL  
**Purpose:** Local indexed copy of on-chain ReputationRecord data for fast queries

```typescript
class AgentEntity extends BaseEntity {
  agentId: string; // Solana pubkey (indexed)
  operator: string; // Operator pubkey
  capabilityHash: string; // SHA256 hex
  reputationScore: number; // 0–10000
  slashCount: number; // Slash counter
  totalAttestations: number; // Attestation count
  totalTasks: number; // Task count
  arweaveeCid: string; // Arweave txid
  stakedAmount: number; // Total USDC staked (from FundAccount)
  registeredAt: Date; // Registration timestamp
  lastUpdated: Date; // Last sync timestamp
}
```

**Key Operations:**

- Upserted by auto-attestation watcher every 30s
- Queried by `GET /agents/:id` endpoint (x402-gated)
- Supports filters/aggregations (batch lookups, sorting)

**Why it exists:** Solana's `getProgramAccounts` is slow and expensive for complex queries. Indexer provides <300ms response times with filters, joins, and pagination.

---

### 7. ReceiptEntity (receipts table)

**Database:** SQLite → PostgreSQL  
**Purpose:** Metadata pointer to execution receipts stored on Arweave

```typescript
class ReceiptEntity extends BaseEntity {
  agentId: string; // Which agent (indexed)
  taskId: string; // Which task (unique index)
  outputHash: string; // SHA256 of receipt JSON
  timestamp: number; // Execution timestamp (unix)
  cid: string; // Arweave transaction ID
}
```

**Key Operations:**

- Created during `POST /receipts/upload`
- Queried by `GET /receipts/:taskId`
- Queried by `GET /receipts/agent/:agentId`

**Why it exists:** Arweave is permanent but slow. This table provides fast lookup of "which Arweave txid contains task X's receipt" without iterating all of Arweave.

---

### 8. AttestationEntity (attestations table) [Planned]

**Database:** SQLite → PostgreSQL  
**Purpose:** Historical record of all attestations submitted for an agent

```typescript
class AttestationEntity extends BaseEntity {
  agentId: string; // Which agent
  taskId: string; // Which task
  attestedBy: string; // Validator pubkey
  score: number; // 0–100
  stakeWeight: number; // USDC staked at attestation time
  blockTime: Date; // When attestation hit chain
  transactionSig: string; // Solana tx signature
}
```

**Why it exists:** Provides audit trail for reputation changes. Supports `GET /agents/:id/history` endpoint showing how reputation evolved over time.

---

### 9. SlashEntity (slashes table) [Planned]

**Database:** SQLite → PostgreSQL  
**Purpose:** Historical record of all slash events

```typescript
class SlashEntity extends BaseEntity {
  agentId: string; // Agent that was slashed
  challengeId: string; // Challenge PDA that triggered slash
  challenger: string; // Who filed the challenge
  failureType: string; // MissedDeadline | OutOfScopeCall | etc
  slashAmount: number; // USDC slashed
  reputationBefore: number;
  reputationAfter: number;
  blockTime: Date;
  transactionSig: string;
}
```

**Why it exists:** Permanent slash history for transparency. Cannot be erased by agent — immutably indexed from on-chain events.

---

### 10. ReputationSnapshotEntity (reputation_snapshots table) [Planned]

**Database:** SQLite → PostgreSQL  
**Purpose:** Links to historical reputation snapshots stored on Arweave

```typescript
class ReputationSnapshotEntity extends BaseEntity {
  agentId: string; // Which agent
  snapshotCid: string; // Arweave txid
  reputationScore: number;
  slashCount: number;
  attestationCount: number;
  previousCid: string; // Forms linked list on Arweave
  triggeredBy: string; // attestation | slash | manual
  createdAt: Date;
}
```

**Why it exists:** Provides `GET /agents/:id/snapshots` endpoint showing full audit trail. Each snapshot links to previous one on Arweave, forming tamper-evident chain.

---

## Data Structures (Not Stored in DB)

### 11. ExecutionReceipt (JSON)

**Stored:** Arweave (permanent)  
**Purpose:** Agent's signed accountability statement for a completed task

```json
{
  "schema_version": "1.0",
  "task_id": "7f3a9c...",
  "agent_id": "AgentPubkey...",
  "operator": "OperatorPubkey...",
  "assigned_by": "TraderPubkey...",
  "timestamp_unix": 1743724800,
  "execution": {
    "tx_signatures": ["5Kj8xVmN3...", "9xQeWvG81..."],
    "programs_called": ["JUP6LkbZbjS1..."],
    "instructions_executed": ["swap", "route_swap"],
    "token_transfers": [
      { "mint": "EPjFWdd5...", "amount": 1000000, "direction": "out" },
      { "mint": "So111111...", "amount": 5230000, "direction": "in" }
    ]
  },
  "result": {
    "status": "success",
    "summary": "Swapped 1 USDC for 0.00523 SOL at 191.2 USDC/SOL"
  }
}
```

**Verification:**

```
output_hash     = SHA256(canonical JSON, keys sorted)
agent_signature = Ed25519.sign(output_hash, agent_private_key)
```

**Why it exists:** Multi-transaction tasks span many Solana txs — which one represents "the task"? The receipt is the agent's explicit claim of what happened, signed and permanent.

---

### 12. CapabilityManifest (JSON)

**Stored:** Arweave (permanent)  
**Purpose:** Defines what protocols an agent is authorized to interact with

```json
{
  "schema_version": "1.0",
  "agent_id": "AgentPubkey...",
  "operator": "OperatorPubkey...",
  "template": "DEX_TRADER_V1",
  "allowed_programs": [
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
  ],
  "allowed_instructions": ["swap", "route_swap", "whirlpool_swap"],
  "constraints": {
    "max_slippage_bps": 100,
    "max_amount_per_tx": 10000000000,
    "require_deadline": true
  },
  "expires_at": 1756339200,
  "signature": "4Kd9sP..."
}
```

**Verification:**

```
capability_hash = SHA256(canonical JSON)
```

Stored in `ReputationRecord.capability_hash` — immutable after registration.

**Why it exists:** Enables `OutOfScopeCall` challenges. If agent calls a program not in `allowed_programs`, challenge is valid and automatically slashable.

---

### 13. ReputationSnapshot (JSON)

**Stored:** Arweave (permanent)  
**Purpose:** Tamper-evident history of reputation state at a point in time

```json
{
  "agent_id": "AgentPubkey...",
  "reputation_score": 8750,
  "slash_count": 1,
  "total_attestations": 47,
  "total_tasks": 52,
  "staked_amount": 850000000,
  "capability_hash": "3d8f7a...",
  "timestamp_unix": 1743724800,
  "previous_cid": "ArweaveTxId...",
  "triggered_by": "attestation",
  "block_height": 287654321
}
```

Linked list structure: each snapshot points to `previous_cid`, forming full audit trail back to registration.

**Why it exists:** Reputation can't be tampered with retroactively. Each snapshot is permanent on Arweave and verifiable against on-chain state at that block height.

---

## Entity Relationships

```
┌──────────────────┐
│ ReputationRecord │ ← source of truth for trust decisions
│ (on-chain PDA)   │
└────────┬─────────┘
         │ references
         ▼
┌──────────────────┐         ┌──────────────────┐
│  FundAccount     │ ──1:N─→ │ StakerPosition   │
│  (on-chain PDA)  │         │ (on-chain PDA)   │
└────────┬─────────┘         └──────────────────┘
         │ slashed by
         ▼
┌──────────────────┐         ┌──────────────────┐
│  Challenge       │ ──1:1─→ │  TaskRecord      │
│  (on-chain PDA)  │         │  (on-chain PDA)  │
└──────────────────┘         └──────────────────┘
         │ creates
         ▼
┌──────────────────┐
│ ReputationSnapshot│ → stored on Arweave
│ (JSON)           │   linked list via previous_cid
└──────────────────┘

OFF-CHAIN INDEXER (mirrors on-chain state):
┌──────────────────┐         ┌──────────────────┐
│  AgentEntity     │ ──1:N─→ │ AttestationEntity│
│  (SQLite/PG)     │         │ (SQLite/PG)      │
└────────┬─────────┘         └──────────────────┘
         │
         ├─────1:N─→ ┌──────────────────┐
         │           │  ReceiptEntity   │
         │           │  (SQLite/PG)     │ ──points to→ ExecutionReceipt (Arweave)
         │           └──────────────────┘
         │
         └─────1:N─→ ┌──────────────────┐
                     │  SlashEntity     │
                     │  (SQLite/PG)     │
                     └──────────────────┘
```

---

## Summary

| **Entity**               | **Storage** | **Purpose**                             | **Access Pattern** |
| ------------------------ | ----------- | --------------------------------------- | ------------------ |
| ReputationRecord         | Solana PDA  | Agent identity & reputation             | Read-heavy         |
| FundAccount              | Solana PDA  | Staked funds & slashing target          | Write-heavy        |
| StakerPosition           | Solana PDA  | Individual staker's position            | Independent        |
| Challenge                | Solana PDA  | Challenge filing & adjudication         | Event-driven       |
| TaskRecord               | Solana PDA  | Ground truth for task parameters        | Verify-only        |
| AgentEntity              | Indexer DB  | Fast-query mirror of ReputationRecord   | Read-heavy         |
| ReceiptEntity            | Indexer DB  | Arweave CID lookup for receipts         | Read-heavy         |
| AttestationEntity        | Indexer DB  | Historical attestation audit trail      | Read-only          |
| SlashEntity              | Indexer DB  | Historical slash audit trail            | Read-only          |
| ReputationSnapshotEntity | Indexer DB  | Arweave CID lookup for snapshots        | Read-only          |
| ExecutionReceipt         | Arweave     | Agent's signed accountability statement | Permanent          |
| CapabilityManifest       | Arweave     | Agent's authorization scope             | Permanent          |
| ReputationSnapshot       | Arweave     | Tamper-evident reputation history       | Permanent          |

**Key Design Decisions:**

- **Two-pool separation:** Registry (read-heavy) vs Fund (write-heavy) avoids account contention
- **StakerPosition PDAs:** Each staker owns their PDA — no operator signature needed for rewards
- **TaskRecord requirement:** Prevents frivolous challenges with no verifiable parameters
- **Arweave for permanence:** Receipts and snapshots can't be deleted or modified
- **Indexer for speed:** <300ms queries with filters — Solana `getProgramAccounts` too slow
- **SQLite → PostgreSQL:** Zero setup for node operators, optional upgrade for high-scale deployments
