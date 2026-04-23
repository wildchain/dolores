# Dolores

**AI agent accountability infrastructure on Solana.**

Dolores makes agent failure expensive — automatically, permanently, and without a central authority. Economic staking, automatic slashing, and on-chain reputation combine into a trust layer for the Solana agent ecosystem.


---

## The Problem

AI agents are already managing real money on Solana — executing trades, managing liquidity, processing payments — with no accountability infrastructure behind them. When something goes wrong, there is no recourse.

## The Insight

Every DeFi skill on `solana.com/skills` teaches an agent **how** to use a protocol. Not one of them answers **whether** that agent should be trusted.

```
Jupiter Skill  → teaches agent HOW to trade
Kamino Skill   → teaches agent HOW to lend
Dolores Skill  → answers WHETHER to trust the agent doing all of the above
```

## How It Works

```
Operator registers agent → stakes SOL → agent gets capability template
User assigns task        → instruction stored on-chain with deadline
Agent runtime            → Claude reads SKILL.md → executes → signs receipt
Accountability           → output_hash stored on-chain → reputation updated
Challenge                → missed deadline or out-of-scope call → auto-slashed
No humans involved       → ever
```

---

## On-Chain Programs (Solana Devnet)

| Program | Address |
|---|---|
| `dolores_registry` | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` |
| `dolores_fund` | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` |
| `dolores_adjudication` | `8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A` |

---

## Repo Structure

```
dolores/
  dolores-programs/   ← Anchor programs (registry, fund, adjudication)
  dolores-cli/        ← CLI for operators and users
  dolores-agent/      ← Autonomous agent runtime
  dolores-skills/     ← Agent Skills for Claude Code
  indexer/            ← NestJS indexer + REST API
  dolores-jade/       ← Next.js frontend
```

---

## Quick Demo (3 terminals)

### Prerequisites
- Solana CLI + devnet wallet with SOL (`solana airdrop 2`)
- Node.js 18+
- PostgreSQL running locally
- Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Terminal 1 — Indexer
```bash
cd indexer
cp .env.development.example .env.development  # fill in DB credentials
npm install
npm run start:dev
```

### Terminal 2 — Agent Runtime
```bash
cd dolores-agent
cp .env.example .env  # fill in ANTHROPIC_API_KEY and AGENT_ID
npm install
npm run dev
```

### Terminal 3 — CLI
```bash
cd dolores-cli
npm install
npm run build

# Register a new agent
node dist/src/index.js register

# Stake SOL
node dist/src/index.js stake \
  --agent-id <AGENT_PUBKEY> \
  --amount 0.5

# Assign a task — agent picks it up within 3 seconds
node dist/src/index.js assign \
  --agent-id <AGENT_PUBKEY> \
  --instruction "transfer 0.001 SOL to <RECIPIENT_PUBKEY>" \
  --deadline 30

# Check what happened
node dist/src/index.js history --agent-id <AGENT_PUBKEY>
```

### What you'll see

```
Agent picks up task within 3s
Claude reads SOL_TRANSFER skill → parses instruction
SOL transfer executes on devnet
Receipt signed with agent keypair
complete_task() → output_hash stored on-chain
submit_attestation() → reputation increments
```

---

## Test the Slash Path

```bash
# Challenge an agent for a missed deadline
node dist/src/index.js challenge \
  --agent-id <AGENT_PUBKEY> \
  --type missed-deadline

# Check reputation dropped
node dist/src/index.js history --agent-id <AGENT_PUBKEY>
```

Slash economics:
- 60% of staked SOL → challenger
- 40% → treasury
- Reputation × 0.35 (permanent decay)
- slash_count +1 (never resets, banned at 3)

---

## CLI Commands

```bash
dolores register                                    # create + register agent
dolores stake      --agent-id <p> --amount 0.5      # stake SOL into vault
dolores assign     --agent-id <p> --instruction "…" # assign task on-chain
dolores task-status --task-id <hex>                 # check task progress
dolores verify     --agent-id <p>                   # check trust level
dolores history    --agent-id <p>                   # reputation history
dolores challenge  --agent-id <p> --type <type>     # file challenge
dolores run        --agent-id <p>                   # legacy: direct SOL transfer
```

---

## Agent Skills

Install the Dolores skill into Claude Code:

```bash
npx skills add https://github.com/wildchain/dolores/tree/main/dolores-skills
```

Then talk to Claude Code naturally:
- *"Register a new Dolores agent"*
- *"Check the reputation of agent \<pubkey\>"*
- *"Assign a task to transfer 0.001 SOL to \<pubkey\>"*
- *"Challenge agent \<pubkey\> for a missed deadline"*

---

## Capability Templates

| Template | Allowed Programs | Max Transfer |
|---|---|---|
| `SOL_TRANSFER` | System Program only | 1 SOL |
| `JUPITER_TRADER` | Jupiter v6, Jupiter Lend | 50,000 USDC |
| `RAYDIUM_LP` | Raydium AMM v4, CLMM, CPMM | 50,000 USDC |
| `ORCA_WHIRLPOOL` | Orca Whirlpools | 50,000 USDC |
| `KAMINO_LENDING` | Kamino Lending, Liquidity | 50,000 USDC |
| `METEORA_POOLS` | Meteora DLMM, AMM | 50,000 USDC |
| `PYTH_ORACLE_READER` | Pyth oracle | Read-only |

---

## verify_agent() — DeFi Protocol Integration

```rust
let (trusted, _) = cpi::verify_agent(
    agent_id,
    min_reputation: 5000,
    min_stake: 10_000_000,
)?;
if trusted { /* grant access */ }
else { return Err(AgentNotTrusted) }
// No account. No fee. No dashboard.
```

Returns `true` if:
- `reputation_score >= min_reputation`
- `declared_stake >= min_stake_lamports`
- `slash_count < 3`

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Skills Layer                    │
│   dolores-skills → Claude Code → operator CLI   │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│              Off-Chain Services                  │
│   dolores-agent (runtime) + indexer (NestJS)    │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│             On-Chain Programs                    │
│   registry + fund + adjudication (Anchor)       │
└─────────────────────────────────────────────────┘
```

---

## Live Transactions (Devnet)

| Action | Explorer |
|---|---|
| Task assigned | [view](https://explorer.solana.com/tx/uPduQ3HexZdjCvgv6LmZRoURz42VsJFhSsAftqaBbmuFVj5eaeWMgiQNPcbvfFMh9b2cww8MThvFNyHcA8YevpP?cluster=devnet) |
| SOL transfer executed | [view](https://explorer.solana.com/tx/hKQGMApaWjU5BD8t3WKPeA6uu3aQuwJBV2DFb8caofWFUd2Rroxr2MeF6WpSUtzUarX362GmZY4RnaCbwXWDS81?cluster=devnet) |
| output_hash on-chain | [view](https://explorer.solana.com/tx/5YrXMwFU8B4PBDH13U7LGiCkcyNfz2CxQg5LUvnScdFD4dNoBrYC1pKarQZfRJBqczhdCwi117v5kxWe7sz3PZSo?cluster=devnet) |
| Attestation submitted | [view](https://explorer.solana.com/tx/575URNHBe9z7mx3SYY2pWav5xv3b22wiHTM2Bcrx9QH613TUUU85CkEdFj2CcZrsPQv2Lk9AApphwLqZYYnZ1PaL?cluster=devnet) |
| Slash executed | [view](https://explorer.solana.com/tx/3wPgMSvfKdHyE6oT7enZgAhE1qZQX32hx4ZkryeN6AmmGgNNSnjwZSrHQKstp6fK6YJCEBrJ8Ae1CDhr7mnBfGKZ?cluster=devnet) |

---

## License

MIT