**1. The Problem**

AI agents on Solana are already managing real money — executing trades, managing liquidity pools, calling APIs — with minimal human oversight. x402 is enabling machine-to-machine payments at scale.

But there is no trust infrastructure. When an agent manages a $500k liquidity pool and something goes wrong, who is accountable? How does a DeFi protocol decide whether to trust an agent it has never interacted with?

| **Existing approach**          | **What breaks**                                                       |
| ------------------------------ | --------------------------------------------------------------------- |
| Centralized reputation systems | Gameable, not portable, controlled by one party                       |
| API key access control         | No behavioral history — a new key wipes the slate                     |
| Manual audits                  | Does not scale to thousands of agents executing millions of tasks     |
| Staking without slashing       | Sybil-friendly — bad actors spin up new identities after each failure |

CLU addresses all of these through one core idea: **make failure expensive, automatically, with no one in charge of deciding.**

---

**2. The Insight — Skills Have No Trust Layer**

Solana's Agent Skills ecosystem (`solana.com/skills`) gives AI coding agents pre-built capability modules. Jupiter has a skill. Kamino has a skill. Raydium, Orca, Meteora — all have skills. Each one tells an agent *how* to interact with a protocol.

Not one of them answers: **should I trust the agent doing the interacting?**

```
Skills ecosystem today:

  Jupiter Skill    →  teaches agent HOW to swap
  Kamino Skill     →  teaches agent HOW to lend
  Raydium Skill    →  teaches agent HOW to provide liquidity

  CLU Skill        →  answers WHETHER to trust the agent doing all of the above
```

Skills are the **capability layer**. CLU is the **trust layer** that sits beneath every skill. They are not competing — they operate at different times in the agent lifecycle.

```
BUILD TIME                         RUNTIME
──────────────────                 ──────────────────────────
Developer + Claude Code            Agent executing autonomously
reads SKILL.md                     signs transactions
writes integration code            manages real money
tests on devnet                    no human in the loop

← Skills live here →               ← CLU lives here →
```

This means CLU can reach developers through the Skills ecosystem itself — before any protocol integration is needed, before any frontend is built. When a developer installs the CLU skill and asks Claude Code to "build a Jupiter trading agent," the generated code automatically includes execution receipts, output hash signing, and pre-execution trust guards. The accountability is injected at build time.

---

**3. What CLU Is**

CLU is a four-layer protocol:

**Layer 1 — Skills (build time).** A set of `SKILL.md` files that developers install into Claude Code via `npx skills add clu-protocol/skills`. These inject CLU accountability patterns — execution receipt generation, output hash signing, `verify_agent()` guards — into any agent Claude Code generates. Developers do not write CLU code themselves; Claude Code writes it for them.

**Layer 2 — Off-chain services (runtime).** An auto-attestation watcher that monitors on-chain agent activity and submits reputation updates automatically. An indexer that parses program events into a queryable database. An x402-gated API that sells structured registry access for 0.001 USDC per lookup.

**Layer 3 — On-chain programs (trust source of truth).** Three Anchor programs on Solana that store agent identity, manage staked funds, and execute slashes with no human in the loop. These are the immutable, composable foundation everything else builds on.

**Layer 4 — Consumers.** DeFi protocols calling `verify_agent()` via CPI before granting pool access. Traders hiring agents through the task queue. Community stakers backing agents they trust and earning proportional rewards.

---

**4. Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│  SKILLS LAYER — build time                                  │
│                                                             │
│  clu-register   clu-wrap-jupiter   clu-wrap-kamino          │
│  clu-wrap-raydium   clu-wrap-orca   clu-verify              │
└───────────────────────┬─────────────────────────────────────┘
                        │ inject accountability at codegen
┌───────────────────────▼─────────────────────────────────────┐
│  OFF-CHAIN SERVICES — runtime                               │
│                                                             │
│  Auto-attestation watcher   Indexer (SQLite→PG)             │
│  x402 API server            Arweave uploader                │
└───────────────────────┬─────────────────────────────────────┘
                        │ submits on-chain txs
┌───────────────────────▼─────────────────────────────────────┐
│  ON-CHAIN PROGRAMS — Solana                                 │
│                                                             │
│  clu_registry          clu_fund          clu_adjudication   │
│  (identity/rep)        (money)           (slashing)         │
└───────────────────────┬─────────────────────────────────────┘
                        │ CPI / read
┌───────────────────────▼─────────────────────────────────────┐
│  CONSUMERS                                                  │
│                                                             │
│  DeFi protocols    Traders / users    Community stakers     │
└─────────────────────────────────────────────────────────────┘
```

---

**5. The Skills Layer**

**What a CLU skill is**

A CLU skill is a `SKILL.md` file with YAML frontmatter, following the open Agent Skills specification. When installed into Claude Code, it loads into the agent's context and changes the code Claude generates for any matching task.

```
npx skills add clu-protocol/skills
```

This installs six skills:

| **Skill**          | **What it does**                                             |
| ------------------ | ------------------------------------------------------------ |
| `clu-register`     | Walks operator through full registration in natural language |
| `clu-core`         | Core CLU primitives, error patterns, cross-cutting wrappers  |
| `clu-wrap-jupiter` | Jupiter skill + execution receipt + output_hash generation   |
| `clu-wrap-kamino`  | Kamino skill + execution receipt + output_hash generation    |
| `clu-wrap-raydium` | Raydium skill + execution receipt + output_hash generation   |
| `clu-verify`       | `verify_agent()` CPI patterns for DeFi protocol integration  |

**How the `clu-register` skill works**

When a developer types "set up CLU for my trading agent" in Claude Code, the `clu-register` skill activates and Claude Code walks through the entire onboarding:

```
Developer: "Set up CLU for my trading agent"

Claude Code (with clu-register skill):
  "I'll register your agent with CLU. A few questions:

  1. What is your agent's Solana keypair public key?
  2. I see you have the Jupiter and Kamino skills installed —
     I'll suggest DEX_TRADER_V1 and YIELD_OPTIMIZER_V1 templates.
     Does that match what this agent does?
  3. How much USDC do you want to stake? Minimum is 100 USDC.

  Ready? I'll generate the dual-signature registration transaction now."
```

The capability manifest is generated, uploaded to Arweave, and the `register_agent()` transaction is constructed and signed — all inside Claude Code with no separate frontend required.

**How wrapped DeFi skills work**

A wrapped skill is the original protocol skill with CLU accountability injected on top. When Claude Code generates a Jupiter swap using the `clu-wrap-jupiter` skill, it automatically wraps the execution in three patterns:

```
async function executeSwap(params: SwapParams): Promise<string> {
  // CLU Pattern 1: Trust guard — verify agent before execution
  return withCluGuard(AGENT_PUBKEY, 5000, () =>

    // CLU Pattern 2: Deadline guard — halt if deadline too close
    withDeadline(params.deadlineUnix, () =>

      // CLU Pattern 3: Receipt wrapper — generate output_hash after execution
      withCluReceipt(params.taskId, async () => {

        // Standard Jupiter swap — unchanged from integrating-jupiter skill
        const order = await jupiterFetch('/swap/v2/order', { /* params */ });
        const sig = await signAndSend(order.transaction, agentWallet, connection);

        return {
          result: sig,
          txSigs: [sig],
          programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4']
        };
      })
    )
  );
}
```

The developer did not write any of this CLU code. Claude Code generated it because the skill was installed. The agent is pre-instrumented before it ever runs a transaction.

---

**6. On-Chain Programs**

CLU deploys three Anchor programs on Solana. All token operations use USDC (SPL token, 6 decimals).

**Program 1: `clu_registry`**

Stores agent identity and reputation. One **Registry PDA** per agent.

```
// seeds: ["agent_registry", agent.key()]
pub struct ReputationRecord {
    pub agent_id:           Pubkey,    // agent wallet
    pub operator:           Pubkey,    // who registered it
    pub capability_hash:    [u8; 32],  // SHA256 of capability manifest — immutable
    pub reputation_score:   u64,       // 0–10000 (represents 0–100.00%)
    pub slash_count:        u8,        // permanent, never decrements
    pub total_attestations: u64,
    pub total_tasks:        u64,
    pub arweave_cid:        String,    // Arweave txid — pointer to full history
    pub registered_at:      i64,
    pub last_updated:       i64,
    pub bump:               u8,
}
```

**Key instructions:**

`register_agent(capability_hash)`

- Requires both `operator` and `agent` as `Signer` — dual signature enforced at VM level
- Creates Registry PDA and Fund PDA atomically
- `reputation_score = 0` at creation — reputation cannot be purchased
- `capability_hash` is immutable after this point
- Uploads capability manifest to Arweave, anchors CID on-chain

`submit_attestation(task_id, output_hash, agent_signature, score, stake_weight)`

- Verifies `ed25519_verify(agent_signature, sha256(task_id || output_hash), agent_pubkey)` on-chain
- Reputation contribution = `(stake_weight × score) / max_stake`
- Prevents reputation farming — points scale with economic stake at risk

`verify_agent(agent_id, min_reputation, min_stake) → (bool, ReputationRecord)`

- CPI-callable by any Solana program in a single instruction
- Returns `true` if `reputation_score >= min_reputation AND locked_stake >= min_stake`
- This is the composability primitive — the single most important instruction

`write_arweave_cid(agent_id, cid)`

- Updates the Arweave pointer after a slash event or validation round finalizes

---

**Program 2: `clu_fund`**

Manages staked funds. One **Fund PDA** per (operator, agent) pair. One **StakerPosition PDA** per (fund_account, staker) pair.

```
// seeds: ["fund_account", operator.key(), agent_id.key()]
pub struct FundAccount {
    pub operator:            Pubkey,
    pub agent_id:            Pubkey,
    pub validator:           Pubkey,
    pub total_locked_stake:  u64,   // sum of all staker positions
    pub validator_stake:     u64,   // validator's own contribution
    pub community_stake:     u64,   // sum of all non-validator stakers
    pub stake_token_mint:    Pubkey, // USDC mint
    pub staker_count:        u16,
    pub bump:                u8,
}

// seeds: ["staker_position", fund_account.key(), staker.key()]
pub struct StakerPosition {
    pub fund_account:      Pubkey,
    pub staker:            Pubkey,
    pub amount_staked:     u64,
    pub staked_at:         i64,
    pub last_claim_epoch:  u64,     // 7-day epoch tracking
    pub claimable_rewards: u64,
    pub bump:              u8,
}
```

**Why one StakerPosition PDA per staker?** Keeping all stakers inside `FundAccount` as a `Vec` would hit Solana account size limits as the community staker count grows. One PDA per staker is the standard Solana pattern — cheap to create, independently queryable, each staker claims rewards without touching anyone else's account.

**Reward distribution** is proportional to stake, not hardcoded:

```
validator_share = (validator_stake / total_locked_stake) × total_rewards
staker_share    = (staker.amount_staked / total_locked_stake) × total_rewards
```

If the validator stakes 60 USDC and two community stakers contribute 10 and 30 USDC respectively, the 100 USDC total pool distributes rewards 60% / 10% / 30% automatically. No percentages are hardcoded — the math self-adjusts as stakers join or leave.

**Key instructions:**

`stake(amount)` — transfers USDC from operator → vault PDA, creates or updates StakerPosition

`community_stake(amount)` — any user can stake into any agent's fund pool, creates their StakerPosition PDA

`withdraw_stake(amount)` — only if no active challenges; proportional withdrawal

`claim_rewards()` — transfers `claimable_rewards` from vault to staker wallet, resets epoch counter

---

**Program 3: `clu_adjudication`**

Handles challenge filing and automatic slash execution. One **Challenge PDA** per challenge.

```
// seeds: ["challenge", agent_id.key(), nonce.to_le_bytes()]
pub enum FailureType {
    MissedDeadline,    // L2: provable on-chain — auto-adjudicated
    OutOfScopeCall,    // L2: provable on-chain — auto-adjudicated
    SubstantiveFailure // L3: peer validation round [post-hackathon]
}

pub struct Challenge {
    pub agent_id:     Pubkey,
    pub task_id:      [u8; 32],   // must reference a real TaskRecord PDA
    pub challenger:   Pubkey,
    pub bond_amount:  u64,
    pub failure_type: FailureType,
    pub proof_data:   Vec<u8>,    // max 1024 bytes
    pub status:       ChallengeStatus,
    pub filed_at:     i64,
    pub nonce:        u64,
    pub bump:         u8,
}
```

**Also stores TaskRecord PDAs:**

```
// seeds: ["task", agent_id.key(), task_id.as_ref()]
pub struct TaskRecord {
    pub agent_id:        Pubkey,
    pub task_id:         [u8; 32],
    pub assigned_by:     Pubkey,   // user who registered the task
    pub output_hash:     [u8; 32],
    pub agent_signature: [u8; 64],
    pub deadline:        i64,
    pub completed_at:    Option<i64>,
    pub status:          TaskStatus, // Pending | Completed | Slashed
    pub bump:            u8,
}
```

**Why does `file_challenge()` require a `task_id`?** Without a real TaskRecord, a challenger could file a `MissedDeadline` claim against an agent with no verifiable deadline to check. With TaskRecord, `auto_adjudicate()` can verify deadline and agent match deterministically — no subjective judgment required.

**Key instructions:**

`register_task(agent_id, task_id, deadline)` — called by user when hiring an agent

`file_challenge(agent_id, task_id, failure_type, proof_data, bond_amount)` — creates Challenge PDA, locks challenger bond in escrow, minimum bond enforced by program constant

`auto_adjudicate(challenge_id)` — only for `MissedDeadline` and `OutOfScopeCall`; checks TemplateRegistry for known template hash inline (no Arweave fetch for standard templates); valid proof triggers `execute_slash()`, invalid proof dismisses and returns bond

`execute_slash(agent_id, challenge_id)` — the slash mechanic:

- 60% of `locked_stake` → challenger wallet
- 40% → CLU treasury PDA
- `reputation_score = reputation_score × 35 / 100`
- `slash_count += 1` (permanent, never decrements)
- Emits `AgentSlashed` event
- Off-chain listener uploads reputation snapshot to Arweave, anchors CID on-chain

---

**7. The Two-Pool System**

Every other agent registry conflates identity, reputation, and funds into a single account. CLU separates them into two distinct PDA types with different access patterns and lifecycles.

|                | **Agent Registry Pool**                                             | **Agentic Fund Pool**                                      |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Maps           | `agent_id → ReputationRecord`                                       | `(operator, agent_id) → FundAccount`                       |
| Type           | One PDA per agent                                                   | One PDA per (operator, agent) pair                         |
| Access pattern | Read-heavy — queried constantly by external protocols               | Write-heavy — touched during stake, slash, rewards         |
| Key fields     | `reputation_score`, `capability_hash`, `slash_count`, `arweave_cid` | `total_locked_stake`, `validator_stake`, `community_stake` |
| Who writes     | CLU program after attestation or slash                              | Operator (deposit/withdraw), CLU program (slash/rewards)   |

**Why split them?** Reputation reads and fund writes have fundamentally different access patterns. Separating them eliminates account contention. Multiple stakers can also back a single agent without touching its identity record. A community staker's `StakerPosition` PDA is entirely their own — creating it, claiming from it, and closing it does not require the operator's signature.

**Multi-party staking model:**

```
Validator stakes 60 USDC    → Fund PDA total: 60
User A stakes 10 USDC       → Fund PDA total: 70  (StakerPosition PDA created for User A)
User B stakes 30 USDC       → Fund PDA total: 100 (StakerPosition PDA created for User B)

Slash hits total_locked_stake = 100 USDC
  → 60 USDC (60%) to challenger
  → 40 USDC (40%) to CLU treasury
  → All StakerPosition balances reduced proportionally

Rewards distribute every 7 days
  → Validator: 60% of reward pool
  → User A:    10% of reward pool
  → User B:    30% of reward pool
```

The validator always earns the dominant share because they staked the most, not because of a special rule. The proportional math self-adjusts automatically.

---

**8. Task Lifecycle and Execution Receipts**

**The TaskRecord**

Before an agent can be challenged, a `TaskRecord` must exist on-chain. This is registered by the user (trader) when they hire an agent:

```
User pays subscription fee
     │
     ├── Gas allocation → agent wallet (covers tx fees)
     ├── Fund pool share → distributed to stakers/validators
     └── CLU platform fee → protocol treasury

register_task(agent_id, task_id, deadline) → TaskRecord PDA
```

The `TaskRecord` is the ground truth for challenge resolution. `auto_adjudicate()` checks it directly — no off-chain data, no oracle, no human judgment.

**The Execution Receipt**

When an agent completes a task, it constructs and signs an execution receipt. This is the agent's explicit accountability statement.

```
{
  "schema_version": "1.0",
  "task_id": "7f3a9c...",
  "agent_id": "AgentPubkeyBase58...",
  "operator": "OperatorPubkeyBase58...",
  "assigned_by": "TraderPubkeyBase58...",
  "timestamp_unix": 1743724800,

  "execution": {
    "tx_signatures": ["5Kj8xVmN3...", "9xQeWvG81..."],
    "programs_called": [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
    ],
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

```
output_hash     = sha256(canonical JSON above, keys sorted alphabetically)
agent_signature = sign(output_hash, agent_private_key)
```

**Why `output_hash` cannot be replaced by the Solana tx signature:**

| **Gap**                 | **Why tx signature doesn't cover it**                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| Multi-transaction tasks | One task often spans 3–10 txs — which one represents the task?                  |
| Explicit responsibility | Agent signing output_hash is a deliberate accountability act, not a side effect |
| Off-chain tasks         | A data-labeling agent produces no Solana txs — output_hash is the only record   |
| Capability verification | The receipt's `programs_called` maps directly to the capability manifest        |

**Independent Verifiability**

Anyone can verify an output_hash claim in five steps:

1. Retrieve receipt from Arweave using `arweave_cid` from Registry PDA
2. `sha256(receipt_json) == output_hash` on Registry PDA → receipt is authentic
3. `ed25519_verify(agent_signature, output_hash, agent_pubkey)` → agent signed it
4. Look up `tx_signatures` on Solana RPC → did these transactions actually happen?
5. `programs_called` in receipt match actual tx instructions → agent reported honestly

A challenger walks all five steps to build a slash proof. A DeFi protocol walks steps 1–4 to trust an agent's work history.

---

**9. Attestation**

**Path 1 — Auto-Attestation (Primary Path)**

CLU runs an off-chain watcher that monitors all three CLU programs via Solana websocket. When it detects an agent completing a verifiable action, it generates and submits an attestation automatically. No hiring protocol integration required.

```
Agent executes Jupiter swap → watcher detects on-chain:
  - agent_pubkey signed the transaction
  - programs_called ⊆ allowed_programs in capability manifest
  - transaction succeeded
  - output_hash signed by agent keypair

Watcher calls submit_attestation():
  - score derived from objective execution quality
  - stake_weight = agent's current locked_stake
```

**Auto-score derivation:**

| **Outcome**                                             | **Score** |
| ------------------------------------------------------- | --------- |
| Completed, all programs within allowlist                | 85        |
| Completed, within slippage tolerance                    | 90        |
| Completed, exceeded slippage but within manifest limits | 65        |
| Completed before deadline                               | +10 bonus |

**Path 2 — Protocol Attestation (Quality Layer)**

For subjective outcomes, a hiring protocol submits a quality score from their backend:

```
await clu.attest({
  agentId: "AgentPubkey...",
  taskId: "task_123",
  outputHash: "7f3a9c...",
  agentSignature: "base64sig...",
  score: 85,
  stakeWeight: 5000,
  signerKeypair: hiringProtocolKeypair
});
```

CLU validates their signature, submits the on-chain transaction, and covers the gas (recovered via x402 API revenue). No Solana program changes required on the protocol's side.

**The `verify_agent()` Flywheel**

Once `verify_agent()` becomes standard for DeFi protocols, hiring protocols gain a direct incentive to submit quality attestations — better-attested agents score higher, get more work, and attract more community stakers. Attestation becomes economically self-interested. No evangelism needed.

---

**10. The Slashing System**

**Failure Types**

| **Failure type**         | **Examples**                                                    | **How adjudicated**               |
| ------------------------ | --------------------------------------------------------------- | --------------------------------- |
| Objective / provable     | Missed deadline, out-of-scope program call, transfer over limit | L2: Auto on-chain — no humans     |
| Subjective / qualitative | Output delivered but wrong, adversarial behavior                | L3: Peer validation [post-launch] |

**L2 Auto-Adjudication — The Core Mechanic**

For `MissedDeadline` and `OutOfScopeCall`, `auto_adjudicate()` resolves entirely on-chain:

```
pub fn auto_adjudicate(ctx: Context<AutoAdjudicate>, challenge_id: Pubkey) -> Result<()> {
    let challenge = &ctx.accounts.challenge;
    let task = &ctx.accounts.task_record;
    let agent = &ctx.accounts.registry_pda;

    // Verify task_id matches and agent matches
    require!(task.agent_id == challenge.agent_id, CluError::TaskAgentMismatch);

    match challenge.failure_type {
        FailureType::MissedDeadline => {
            // Did the agent complete after the deadline?
            require!(
                task.completed_at.is_none() ||
                task.completed_at.unwrap() > task.deadline,
                CluError::DeadlineNotActuallyMissed
            );
        },
        FailureType::OutOfScopeCall => {
            // Did programs_called contain something not in capability_hash?
            // Check TemplateRegistry first — no Arweave fetch for standard templates
            if let Some(template) = template_registry.get(&agent.capability_hash) {
                verify_against_template(&challenge.proof_data, template)?;
            } else {
                verify_against_custom_manifest(&challenge.proof_data)?;
            }
        },
        _ => return Err(CluError::RequiresPeerValidation)
    }

    execute_slash(ctx)?;
    Ok(())
}
```

**No human can interfere with this.** Once a valid proof is submitted and `auto_adjudicate()` is called, the slash is irreversible and immediate.

**Slash Economics**

```
On valid proof:
  60% of locked_stake  →  challenger wallet      (reward enforcement)
  40% of locked_stake  →  CLU treasury PDA       (protocol sustainability)

  reputation_score  =  reputation_score × 35 / 100
  slash_count      +=  1  (permanent, never decrements)

On invalid proof:
  challenger bond   →  returned in full (bond only filters spam)
  agent             →  unaffected
```

**Reputation decay per slash:**

```
One slash:   100% → 35%
Two slashes: 100% → 35% → ~12%
Three:       100% → 35% → 12% → ~4%
```

A triple-slashed agent is effectively blacklisted from any DeFi protocol using reasonable `min_reputation` thresholds.

**Challenge UX — One Button**

The challenge flow for a trader is entirely abstracted. On the task panel, each completed task shows a single "Challenge" button. Clicking it:

1. Detects the `task_id` from context (no user input required)
2. Prompts for bond confirmation (5–10 USDC default)
3. Calls `file_challenge()` on-chain
4. Card status changes: `Completed → Challenged → Resolved: Slashed / Dismissed`

For L2 failures, resolution happens in under one Solana slot (~400ms). The card updates automatically.

**Bond sizing rationale.** The bond must filter spam without chilling legitimate challenges. A reasonable default is ~2% of the agent's staked value. For a 500 USDC staked agent, a 10 USDC bond is appropriate. This can be made governance-adjustable post-launch.

---

**11. x402-Gated Registry API**

External protocols querying CLU's registry pay via x402 — the HTTP-native micropayment protocol settling on Solana. A free registry has no revenue model, no spam filter, and no signal on data value.

**Endpoints and pricing:**

| **Endpoint**                                     | **Price**        |
| ------------------------------------------------ | ---------------- |
| `GET /agents/:id` — single agent lookup          | 0.001 USDC       |
| `GET /agents/batch` — up to 100 agents           | 0.05 USDC        |
| `GET /agents/:id/history` — full Arweave history | 0.01 USDC/minute |

**Payment flow:**

```
Client sends request with no payment header
     ↓
Server returns 402 + { amount: "0.001", token: "USDC", network: "solana-devnet" }
     ↓
Client sends USDC tx on Solana, retries with X-Payment header
     ↓
Server verifies tx on-chain → serves data
Total round-trip: < 500ms
```

**What is always free:** Raw Solana PDA data is public. Anyone running their own RPC node can read Registry and Fund PDAs directly at no cost. The x402 gate applies only to the indexed, structured API layer — not to the on-chain truth itself.

This means `verify_agent()` CPI calls (the composability primitive) are always free. The x402 gate is for discovery and bulk lookup, not for runtime trust checks.

---

**12. Arweave Storage Integration**

Full reputation history is too large and too permanent for Solana accounts. CLU stores the Arweave transaction ID on-chain — the chain stores the pointer, Arweave stores the data permanently and immutably.

**What lives where:**

| **Data**                                         | **Storage**                   | **Why**                                                       |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `reputation_score`, `slash_count`, `arweave_cid` | Solana on-chain               | Must be composable — `verify_agent()` reads via CPI           |
| `locked_stake`, balances                         | Solana on-chain (Fund PDA)    | Token transfers must be atomic and trustless                  |
| Full reputation history, slash snapshots         | Arweave                       | Too large for Solana. Permanent. Cannot be deleted by anyone. |
| Link between chain and storage                   | `arweave_cid` in Registry PDA | Full audit trail reconstructable from on-chain data alone     |

**Write flow (triggered by `AgentSlashed` or `RoundFinalized` event):**

```
Off-chain listener catches event
     ↓
Serialize full ReputationRecord + event history to JSON
     ↓
Upload to Arweave via arweave-js → get txid
     ↓
Call write_arweave_cid(agent_id, txid) on-chain
     ↓
Registry PDA now contains pointer to permanent history
```

The `arweave_cid` field is storage-layer-agnostic. Switching storage providers post-launch requires only swapping the upload SDK — no on-chain program changes.

---

**13. User Journeys**

**Journey A: Operator / Developer**

```
1. npx skills add clu-protocol/skills
        └── installs 6 CLU skills into Claude Code

2. "Set up CLU for my trading agent"
        └── clu-register skill activates
        └── Claude Code asks: keypair, capability templates, stake amount
        └── Generates registration transaction
        └── Dual-sig tx fires (operator + agent co-sign)
        └── Registry PDA + Fund PDA created on-chain

3. "Build a Jupiter trading agent"
        └── clu-wrap-jupiter skill activates
        └── Claude Code generates code with withCluGuard + withCluReceipt wrappers
        └── Agent is pre-instrumented before first transaction

4. Deploy agent
        └── Auto-attestation watcher picks up every tx automatically
        └── reputation_score climbs with each successful task

5. Check dashboard
        └── View reputation history, task queue, staker positions
        └── Claim 7-day epoch rewards
```

**Journey B: Trader / User**

```
1. Browse agent explorer
        └── Filter by min reputation score, total staked, capability type
        └── See real on-chain history — not marketing copy

2. Pay subscription
        └── Fee splits: gas allocation → fund pool → CLU platform fee

3. Register task
        └── TaskRecord PDA created on-chain with deadline

4. Agent executes task from queue
        └── Signs output_hash on completion
        └── Receipt uploaded to Arweave

5. Review completed task card
        └── Status: Completed / Pending / Failed

6a. Satisfied → done, agent reputation rises

6b. Unsatisfied → click "Challenge"
        └── Bond deducted from wallet
        └── file_challenge() fires with task_id pre-filled
        └── auto_adjudicate() resolves in < 1 Solana slot
        └── Card shows: Resolved: Slashed or Resolved: Dismissed
```

**Journey C: Community Staker**

```
1. Browse agent explorer
        └── Find agent with strong reputation + validator stake

2. View agent profile
        └── See: reputation history, total staked, validator's stake amount
        └── See: task success rate, slash count (permanent)

3. Stake USDC
        └── StakerPosition PDA created for staker
        └── total_locked_stake increases

4. Earn rewards every 7 days
        └── Proportional to (my_stake / total_locked_stake)
        └── Claim at any time from StakerPosition PDA

5. Exit at any time
        └── No active challenge → withdraw full position
        └── Active challenge → position locked until resolution
```

**Journey D: DeFi Protocol**

```
1. Add one CPI call to existing program:

   let (trusted, record) = cpi::verify_agent(
       agent_id,
       min_reputation: 5000,   // 50.00%
       min_stake: 10_000_000,  // 10 USDC
   )?;

   if trusted { /* grant access */ } else { return Err(AgentNotTrusted) }

2. That's it.
   No frontend changes. No CLU account required. No integration fee.
   The trust signal comes from the on-chain record CLU has been building
   since the agent registered.
```

---

**14. Off-Chain Components**

**Auto-Attestation Watcher (TypeScript)**

Monitors all three CLU programs via Solana websocket subscription. On detecting a completed agent task transaction, it:

1. Verifies `programs_called ⊆ allowed_programs` from capability manifest
2. Derives an objective score from execution quality metrics
3. Calls `submit_attestation()` on-chain automatically
4. Uploads execution receipt to Arweave, triggers `write_arweave_cid()`

The watcher is CLU-team-operated at hackathon stage. Long-term: decentralized watcher network where external parties run nodes and earn bounties for accurate attestations.

**x402 API Server (Node.js / TypeScript)**

```
GET /agents/:id          → single ReputationRecord   (0.001 USDC)
GET /agents/batch        → up to 100 records         (0.05  USDC)
GET /agents/:id/history  → full Arweave history      (0.01  USDC/min)
```

All endpoints return a `402` with payment details if no valid `X-Payment` header is present. Payment verification happens on-chain before any data is served.

**Indexer (TypeScript)**

Subscribes to all three CLU program event streams. Parses `AgentRegistered`, `AttestationSubmitted`, `AgentSlashed` events. Writes to SQLite (hackathon) → PostgreSQL (production). Powers the x402 API with fast indexed reads rather than RPC calls.

**CLI (TypeScript)**

```
clu register   --agent-id <pubkey> --capability-hash <hex>
clu stake      --agent-id <pubkey> --amount <usdc>
clu attest     --agent-id <pubkey> --task-id <id> --score <0-100>
clu verify     --agent-id <pubkey> --min-rep <score> --min-stake <usdc>
clu challenge  --agent-id <pubkey> --type missed-deadline --task-id <id>
clu history    --agent-id <pubkey>
```

**Frontend (Next.js)**

| **Page**           | **What it shows**                                                                 |
| ------------------ | --------------------------------------------------------------------------------- |
| Agent Explorer     | Browse all agents, filter by reputation/stake/capability, link to Arweave history |
| Operator Dashboard | Registration flow, stake/unstake, task queue, reputation chart, claim rewards     |
| Task Panel         | Per-agent queue of tasks, status cards, one-click challenge button                |
| Staker View        | Browse agents, stake USDC, view StakerPosition, claim epoch rewards               |

---

**15. Capability Templates**

Instead of operators writing capability manifests from scratch, CLU ships a library of standard templates. The `clu-register` skill presents these as options during onboarding.

**Standard templates:**

| **Template**         | **What it unlocks**                       | **Key constraints**                |
| -------------------- | ----------------------------------------- | ---------------------------------- |
| `DEX_TRADER_V1`      | Jupiter, Orca, Raydium swaps              | max_single_transfer_usdc: 50000    |
| `LP_MANAGER_V1`      | Add/remove liquidity on major Solana AMMs | Whitelisted pool programs only     |
| `ORACLE_READER_V1`   | Pyth + Switchboard price feeds            | Read-only, zero write instructions |
| `TOKEN_TRANSFER_V1`  | USDC/SOL transfers                        | Bounded amount, address whitelist  |
| `YIELD_OPTIMIZER_V1` | Kamino, Drift vault deposit/withdraw      | No borrow instructions             |

**How templates enable faster auto-adjudication:**

Each standard template hash is pre-registered on-chain in a `TemplateRegistry` PDA at protocol deployment. When `auto_adjudicate()` processes an `OutOfScopeCall` challenge, it checks whether the agent's `capability_hash` matches a known template:

```
if let Some(template) = template_registry.get(&agent.capability_hash) {
    // Known template — validate proof inline, no Arweave fetch needed
    verify_against_template(proof_data, template)
} else {
    // Custom manifest — require Arweave CID in proof_data
    verify_against_custom_manifest(proof_data)
}
```

Standard template agents resolve `OutOfScopeCall` slashes entirely on-chain in a single transaction. Most agents will use standard templates, so most objective slashes resolve with no off-chain dependency.

---

**16. Token Decision**

**There is no $CLU token in this build.**

All stakes, bonds, slashes, and rewards flow in USDC. This removes an entire layer of complexity from the hackathon build. A $CLU governance and rewards token is a post-mainnet decision — distributed via governance vote after the protocol has demonstrated sustained activity. No judge penalizes this choice; most will appreciate the honesty.

---

**17. Known Open Problems**

**Cold start.** A registry with no agents has no network effects. Mitigation: seed 3–5 live agents with real stake and task history before the hackathon demo. The operator/developer path via skills is the growth engine — every developer building a DeFi agent with CLU skills installed is a potential registered agent.

**Watcher centralization.** The auto-attestation watcher is off-chain and CLU-team-operated. Long-term fix is a permissionless watcher network with bounty incentives. Acceptable at hackathon stage.

**Bond calibration.** Challenge bond must balance spam prevention against chilling legitimate challenges. Starting at 5–10 USDC with governance-adjustable parameters post-launch is the right approach.

**Task queue flooding.** One subscription fee should not unlock unlimited task registrations. The correct model is a per-task micro-fee (0.5–1 USDC per `register_task()` call) so that the fee split into gas/pool/treasury happens on every task. This also makes the fund pool revenue stream more predictable.

**Gas top-up fragility.** An agent that runs out of SOL mid-task will stall and potentially trigger a `MissedDeadline` slash unfairly. Mitigation: enforce a minimum agent wallet balance check at `register_task()` time, before the task enters the queue.

**Peer validation complexity.** `SubstantiveFailure` challenges — where output is delivered but wrong — require a peer validation mechanism to adjudicate fairly. This is intentionally excluded from the hackathon build. The L2 auto-adjudication mechanic is the novel and demo-able part. L3 validation is described in the architecture and deferred to post-launch.

---

**18. Build Plan**

**Pre-hackathon**

- Anchor workspace initialized, devnet wallets funded
- Program IDs reserved on devnet
- Standard template manifests written and uploaded to Arweave
- `TemplateRegistry` PDA seeded with standard template hashes
- Demo script written (exact CLI commands for full scenario)

**Week 1 — Core identity and composability**

- `clu_registry`: `register_agent()` (dual signature), `submit_attestation()` (ed25519 verify), `verify_agent()`
- `clu_fund`: `stake()`, `withdraw_stake()`, `StakerPosition` PDA
- Dummy DeFi program calling `verify_agent()` via CPI — build this week
- `clu-register` SKILL.md — first draft
- Goal: registration + staking + CPI verify all work on devnet

**Week 2 — Slashing and payments**

- `clu_adjudication`: `register_task()`, `file_challenge()`, `auto_adjudicate()` (template-aware), `execute_slash()`
- x402 API server: single agent lookup with payment gate
- Arweave write triggered by slash event, CID anchored on-chain
- Auto-attestation watcher v1 — basic tx monitoring
- Goal: full slash flow runs on devnet

**Week 3 — Skills and frontend**

- All six SKILL.md files finalized with examples/
- `clu-wrap-jupiter` skill with working code examples
- Indexer subscribing to all three programs
- Frontend: Agent Explorer + Operator Dashboard + Task Panel

**Week 4 — Integration and polish**

- Community staking (`community_stake()`, proportional rewards)
- `demo.sh` — full seven-step scenario with zero manual input
- CLI complete and tested against devnet
- All edge cases handled

**Week 5 — Submission**

- 3-minute pitch video
- Written submission materials
- Protocol outreach: 3–5 Solana DeFi teams for `verify_agent()` integration
- Submission to `solana.com/skills` community directory

**Team allocation**

| **Role**     | **Owns**                                                         |
| ------------ | ---------------------------------------------------------------- |
| Rust dev 1   | `clu_registry` + `clu_fund` + `TemplateRegistry` programs        |
| Rust dev 2   | `clu_adjudication` + dummy CPI demo program                      |
| TS dev       | x402 API + indexer + Arweave + auto-attestation watcher + CLI    |
| Frontend dev | Next.js dashboard (starts week 3)                                |
| Product      | SKILL.md files, demo script, documentation, submission materials |

---

**Tech Stack**

| **Layer**          | **Technology**                                         |
| ------------------ | ------------------------------------------------------ |
| On-chain programs  | Rust + Anchor                                          |
| Program client     | `@coral-xyz/anchor` (TypeScript)                       |
| Wallet integration | `@solana/wallet-adapter-react`                         |
| Token transfers    | `@solana/spl-token` (USDC)                             |
| x402 payments      | `x402` npm package                                     |
| Off-chain storage  | Arweave via `arweave-js`                               |
| Skills             | SKILL.md format (Anthropic Agent Skills specification) |
| API server         | Node.js + Express                                      |
| Database           | SQLite → PostgreSQL                                    |
| Frontend           | Next.js                                                |
| Network            | Solana devnet                                          |

---

**The One-Sentence Pitch**

> **CLU is the accountability skill the Solana agent ecosystem didn't know it was missing — every DeFi skill teaches an agent how to interact with a protocol, CLU is the skill that makes that agent answerable for what it does.**

---

_CLU Technical Architecture · v0.4 · April 2026 · Colosseum Frontier Hackathon · Peer validation (L3) intentionally excluded from this build — described in architecture, implemented post-launch._
