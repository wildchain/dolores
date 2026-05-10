# Dolores Protocol

**Decentralized AI Agent Trust & Accountability on Solana**

Dolores is a monorepo protocol for registering, staking, running, and adjudicating autonomous AI agents on-chain. Agents earn reputation through verified task execution, stake SOL as collateral, and can be challenged and slashed for misbehaviour — all without human arbitrators.

---

## What's been built

### Apps

| App           | Description                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS API server — syncs on-chain state, caches agent/task/challenge data, serves the client frontend                 |
| `apps/agents` | Autonomous DeFi agent runtime — Claude-powered execution of Jupiter, Kamino, Meteora, Raydium, PumpFun, and Pyth tasks |
| `apps/cli`    | TypeScript CLI — register agents, run tasks, stake, verify, challenge, assign                                          |
| `apps/client` | Next.js frontend — dashboard, explorer, register, staker, challenges, tasks, attestations                              |
| `apps/ipfs`   | Helia (IPFS) node — pins capability manifests and execution receipts to content-addressed storage                      |

### Packages

| Package                 | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `packages/contracts`    | Anchor IDLs and program IDs for all three on-chain programs         |
| `packages/database`     | Shared RocksDB module for the API and IPFS node                     |
| `packages/shared`       | Shared TypeScript types, DTOs, and interfaces across all apps       |
| `packages/solana-utils` | Common Solana/Anchor helpers (PDA derivation, connection factories) |

### On-chain Programs (Solana devnet)

| Program                | Program ID                                     | What it does                                                          |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `dolores_registry`     | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` | Agent identity, reputation score, slash count, attestation submission |
| `dolores_fund`         | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` | Operator + community staking vault, reward epochs, slash execution    |
| `dolores_adjudication` | `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz` | Task registration, challenge filing, on-chain auto-adjudication       |

---

## Prerequisites

- Node.js 18+
- pnpm 8+ — `npm install -g pnpm`
- Solana CLI — `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
- A Solana wallet keypair at `~/.config/solana/id.json`
- Devnet SOL — get it at https://faucet.solana.com

---

## 1. Install dependencies

```bash
# From the monorepo root
pnpm install

# Build all shared packages first
pnpm --filter='./packages/*' build
```

---

## 2. API server setup

The API server syncs on-chain program events, caches agent/task/challenge/attestation state in RocksDB, and serves all data to the frontend and CLI.

```bash
cd apps/api
```

Create `.env`:

```env
APPLICATION_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
OPERATOR_KEYPAIR_PATH=/Users/<you>/.config/solana/id.json
JWT_SECRET=<your-secret>
IPFS_URL=http://localhost:3001
```

Start the server:

```bash
pnpm start:dev
```

The API runs on port **8080**.

---

## 3. IPFS node setup

The IPFS node (Helia) pins agent capability manifests and execution receipts so they are content-addressed and verifiable.

```bash
cd apps/ipfs
pnpm start:dev
```

The IPFS node runs on port **3001**.

---

## 4. Client setup

```bash
cd apps/client
pnpm dev
```

The frontend runs on port **5173** (Next.js). It includes:

- **Dashboard** — live agent stats and recent activity
- **Explorer** — browse all registered agents
- **Register** — create and register a new agent from a browser wallet
- **Tasks** — view and track task assignments
- **Attestations** — full attestation history per agent
- **Challenges** — view filed challenges and their resolution status
- **Staker** — community staking positions and reward claims

---

## 5. CLI setup

```bash
cd apps/cli
pnpm build
npm link
```

Verify it works:

```bash
dolores --help
```

---

## 6. Agent runtime setup

The agent runtime uses Claude to parse natural-language instructions and execute DeFi operations on Solana.

```bash
cd apps/agents
```

Create `.env`:

```env
ANTHROPIC_API_KEY=<your-key>
SOLANA_RPC_URL=https://api.devnet.solana.com
```

Test individual capabilities:

```bash
pnpm test:jupiter
pnpm test:kamino
pnpm test:meteora
pnpm test:raydium
pnpm test:pumpfun
pnpm test:pyth
pnpm test:sol-transfer
```

---

## 7. Full test sequence

### Step 1 — Register an agent

```bash
dolores register
```

- Select a capability template (e.g. `1` for Jupiter Trader)
- Confirm registration
- Note the **Agent pubkey** printed at the end

The agent keypair is saved to `~/.dolores/agents/<pubkey>.json`.
The capability manifest is pinned to IPFS and its CID is written on-chain.

Registration creates two PDAs:

- `RegistryAccount` on `dolores_registry` — identity and reputation
- `FundAccount` on `dolores_fund` — staking vault

### Step 2 — Check initial reputation

```bash
dolores history --agent-id <AGENT_PUBKEY>
```

Expected: `Reputation: 0 / 10000`, `Last attested: never`

### Step 3 — Fund and stake for the agent

Go to https://faucet.solana.com, request **1 SOL** for both your operator wallet and the agent pubkey.

Then stake SOL to back the agent:

```bash
dolores stake --agent-id <AGENT_PUBKEY> --amount 0.1
```

### Step 4 — Run a task

```bash
dolores run --agent-id <AGENT_PUBKEY> \
  --recipient <ANY_SOLANA_PUBKEY> \
  --amount 0.01
```

Expected output:

```
✅ Transfer confirmed
Transaction : <tx_signature>

✅ Receipt submitted
Attestation tx : <attestation_tx_signature>

Reputation : 42 / 10000
```

Two on-chain transactions are produced:

- The SOL transfer
- The `submit_attestation` call on `dolores_registry`

### Step 5 — Assign a task to an agent

```bash
dolores assign \
  --agent-id <AGENT_PUBKEY> \
  --instruction "Swap 0.1 SOL to USDC on Jupiter" \
  --deadline 60
```

This registers the task on-chain via `dolores_adjudication` and notifies the indexer.

### Step 6 — Check task status

```bash
dolores task-status --task-id <TASK_ID_HEX>
```

### Step 7 — Verify an agent meets thresholds

```bash
dolores verify \
  --agent-id <AGENT_PUBKEY> \
  --min-rep 100 \
  --min-stake 0.1
```

### Step 8 — Challenge a misbehaving agent

```bash
dolores challenge \
  --agent-id <AGENT_PUBKEY> \
  --type missed-deadline
```

This calls `register_task`, `file_challenge`, and `auto_adjudicate` on `dolores_adjudication` in sequence. A valid challenge slashes the agent's stake and drops its reputation.

---

## 8. Security test — invalid signature rejection

Try submitting a fake receipt with an invalid signature:

```bash
curl -X POST http://localhost:8080/receipts/upload \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<AGENT_PUBKEY>",
    "taskId": "fake-task-001",
    "outputHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "timestamp": 1713312000,
    "agentSignature": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }'
```

Expected: `{"statusCode":401,"message":"Invalid agent signature — receipt rejected"}`

Only the agent holding the private key can submit valid receipts for that agent ID.

---

## 9. Agent capabilities

The agent runtime supports six DeFi capability templates. Each has a Claude skill file that defines allowed operations, verified token addresses, and Dolores accountability rules.

| Capability template | Skill                      | What the agent can do                                                |
| ------------------- | -------------------------- | -------------------------------------------------------------------- |
| `JUPITER_TRADER`    | `skills/jupiter-trader.md` | Token swaps via Jupiter Aggregator (max 50,000 USDC/task)            |
| `KAMINO_LENDER`     | `skills/kamino-lend.md`    | Deposit, withdraw, borrow, repay on Kamino; health factor monitoring |
| `METEORA_LP`        | `skills/meteora-dlmm.md`   | Add/remove DLMM concentrated liquidity, swap, collect fees           |
| `RAYDIUM_TRADER`    | `skills/raydium.md`        | Swaps via Raydium Trade API (CPMM, CLMM, AMM)                        |
| `RAYDIUM_LP`        | `skills/raydium.md`        | Add/remove CPMM and CLMM liquidity positions                         |
| `PUMPFUN_TRADER`    | `skills/pumpfun.md`        | Buy/sell on PumpFun bonding curves; bonding curve status checks      |
| `PYTH`              | `skills/pyth.md`           | Live price feeds for 30+ assets via Pyth Hermes API                  |

---

## 10. CLI commands

| Command                                                   | What it does                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `dolores register`                                        | Generate agent keypair, register on-chain (Registry + Fund PDAs), pin manifest to IPFS |
| `dolores history --agent-id <pubkey>`                     | Fetch live on-chain reputation, slash count, and stake                                 |
| `dolores run --agent-id <pubkey>`                         | Run a SOL transfer task and submit an attested execution receipt                       |
| `dolores stake --agent-id <pubkey> --amount <sol>`        | Stake SOL into the agent's FundAccount vault                                           |
| `dolores verify --agent-id <pubkey>`                      | Check agent meets minimum reputation and stake thresholds                              |
| `dolores challenge --agent-id <pubkey> --type <type>`     | File and auto-adjudicate a challenge on-chain                                          |
| `dolores assign --agent-id <pubkey> --instruction <text>` | Assign a task to an agent and register it on-chain                                     |
| `dolores task-status --task-id <hex>`                     | Check on-chain status of a task by its ID                                              |

---

## 11. API endpoints

### Agents

| Method | Endpoint                    | What it does                                                    |
| ------ | --------------------------- | --------------------------------------------------------------- |
| `GET`  | `/agents`                   | List all agents (paginated, filterable by agentId / capability) |
| `GET`  | `/agents/operator/:address` | Get all agents registered by an operator wallet                 |
| `GET`  | `/agents/:agentId`          | Get full on-chain details for an agent                          |
| `GET`  | `/agents/:agentId/tasks`    | Get task history for an agent                                   |

### Tasks

| Method | Endpoint                | What it does                                                      |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| `GET`  | `/tasks`                | List tasks (filterable by agentId, requester, status, capability) |
| `GET`  | `/tasks/:id`            | Get task details                                                  |
| `POST` | `/tasks/build-register` | Build an unsigned `register_task` transaction                     |
| `POST` | `/tasks/build-complete` | Build an unsigned `complete_task` transaction                     |

### Attestations

| Method | Endpoint                       | What it does                      |
| ------ | ------------------------------ | --------------------------------- |
| `GET`  | `/attestations`                | List all attestations (paginated) |
| `GET`  | `/attestations/agent/:agentId` | Attestation history for an agent  |

### Challenges

| Method | Endpoint                            | What it does                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/challenges`                       | List all challenges (filterable by agentId, requester, unresolved) |
| `GET`  | `/challenges/agent/:agentId`        | Challenges filed against an agent                                  |
| `POST` | `/challenges/build-file`            | Build an unsigned `file_challenge` transaction                     |
| `POST` | `/challenges/build-auto-adjudicate` | Build an unsigned `auto_adjudicate` transaction                    |

### Receipts & IPFS

| Method | Endpoint             | What it does                                                   |
| ------ | -------------------- | -------------------------------------------------------------- |
| `POST` | `/receipts/upload`   | Submit an execution receipt — pins to IPFS, stores output hash |
| `POST` | `/ipfs/pin-manifest` | Pin a capability manifest JSON to the IPFS node                |

### Auth

| Method | Endpoint          | What it does                                 |
| ------ | ----------------- | -------------------------------------------- |
| `GET`  | `/auth/challenge` | Get a sign-in challenge message for a wallet |
| `POST` | `/auth/verify`    | Verify a signed challenge — returns JWT      |

---

## 12. How reputation works

Each completed task earns an attestation. The reputation delta per task is:

```
delta = score × stake_weight / 10
      = 85    × 5            / 10
      = 42 points
```

Maximum reputation is **10,000**. It takes roughly 238 successful tasks to reach max reputation at default settings.

A slash drops reputation to **35% of its prior value** and increments `slash_count` permanently. Three slashes effectively blacklists the agent from any protocol using standard thresholds.

---

## 13. Staking economy

| Role             | How to stake                            | Reward                                      |
| ---------------- | --------------------------------------- | ------------------------------------------- |
| Operator         | `dolores stake` / `dolores_fund::stake` | Earns proportional rewards each 7-day epoch |
| Community staker | `dolores_fund::community_stake`         | Backs any agent, earns proportional rewards |

Slashing distributes seized stake: **60% to the challenger**, **40% to the protocol treasury**.

Minimum stake is **0.01 SOL**. Community stakers cannot be the same wallet as the operator.

---

## 14. Challenge & adjudication

The `dolores_adjudication` program automates the full dispute lifecycle with no human arbitrators.

| Instruction       | Who calls it     | What it does                                                           |
| ----------------- | ---------------- | ---------------------------------------------------------------------- |
| `register_task`   | User / requester | Locks task deadline and output hash on-chain                           |
| `complete_task`   | Agent            | Marks task completed; records final output hash                        |
| `file_challenge`  | Any third party  | Files challenge with proof data; locks the agent's fund via CPI        |
| `auto_adjudicate` | Anyone           | Resolves on-chain — valid proof slashes agent, invalid proof dismisses |

Failure types: `MissedDeadline` or `OutOfScopeCall`. Minimum challenge bond: **0.01 SOL**.

---

## 15. On-chain programs

| Program                | Program ID                                     | Explorer                                                                                                          |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dolores_registry`     | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` | [View on devnet](https://explorer.solana.com/address/8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt?cluster=devnet) |
| `dolores_fund`         | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` | [View on devnet](https://explorer.solana.com/address/AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5?cluster=devnet) |
| `dolores_adjudication` | `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz` | [View on devnet](https://explorer.solana.com/address/4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz?cluster=devnet) |

**Network:** Solana devnet

---

## 16. Architecture overview

```
dolores register
  → generates agent keypair locally
  → dual-sig tx (operator + agent)
  → creates RegistryAccount PDA on dolores_registry
  → creates FundAccount + Vault PDA on dolores_fund
  → pins capability manifest JSON to IPFS node
  → CID written on-chain

dolores stake
  → operator transfers SOL to vault PDA on dolores_fund
  → StakerPosition PDA created / updated
  → total_locked_stake increases

dolores assign
  → registers task deadline + output_hash on dolores_adjudication
  → TaskRecord PDA created on-chain
  → indexer notified via POST /tasks

agent runtime (apps/agents)
  → polls indexer for pending tasks assigned to agent
  → Claude parses natural-language instruction against skill file
  → executes DeFi operation (Jupiter swap, Kamino deposit, etc.)
  → builds execution receipt JSON
  → sha256(receipt) = output_hash
  → agent signs output_hash with its ed25519 keypair
  → POST /receipts/upload { agentId, taskId, outputHash, timestamp, agentSignature }
  → API verifies signature
  → API pins receipt to IPFS, stores CID
  → API calls submit_attestation on dolores_registry
  → reputation_score += delta
  → RegistryAccount PDA updated on-chain

dolores challenge
  → calls register_task on dolores_adjudication
  → calls file_challenge — locks fund via CPI to dolores_fund
  → calls auto_adjudicate — valid proof → execute_slash CPI → record_slash CPI
  → 60% of slashed stake → challenger, 40% → treasury
  → reputation drops to 35% of prior value

dolores history / dolores verify
  → GET /agents/:agentId
  → API fetches live RegistryAccount + FundAccount from Solana RPC
  → returns reputation, slash count, declared stake
```
