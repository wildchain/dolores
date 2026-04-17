# Dolores Protocol — Developer Setup

This guide covers how to run the indexer and CLI locally and test the full agent accountability loop on Solana devnet.

---

## What's been built

| Component | What it does |
|---|---|
| `dolores_registry` | Anchor program on Solana devnet — stores agent identity, reputation score, slash count |
| `dolores-cli` | TypeScript CLI — register agents, run tasks, check history |
| `indexer` | NestJS server — receives execution receipts, submits on-chain attestations, serves agent data |

---

## Prerequisites

- Node.js 18+
- Solana CLI installed — `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
- A Solana wallet keypair at `~/.config/solana/id.json`
- Devnet SOL — get it at https://faucet.solana.com

---

## 1. Indexer setup

```bash
cd indexer
npm install
```

Create `.env.development`:

```env
APPLICATION_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=<your-postgres-user>
DATABASE_PASSWORD=
DATABASE_NAME=dolores
DATABASE_SCHEMA=public

SOLANA_RPC_URL=https://api.devnet.solana.com
WATCHER_KEYPAIR_PATH=/Users/<you>/.config/solana/id.json
DOLORES_PROGRAM_ID=DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd
DOLORES_IDL_PATH=/path/to/dolores-programs/target/idl/dolores_registry.json
```

> `AGENT_KEYPAIR_PATH` is no longer needed — agents now sign their own receipts before submitting.

Create the database:

```bash
psql -d postgres -c "CREATE DATABASE dolores;"
```

Start the server:

```bash
npm run start:dev
```

You should see:

```
[AttestationService] Attestation service ready
[AttestationService] Watcher : <your-wallet-pubkey>
[NestApplication] Nest application successfully started
```

The server runs on port **8080**.

---

## 2. CLI setup

```bash
cd dolores-cli
npm install
npm run build
npm link
```

Verify it works:

```bash
dolores --help
```

---

## 3. Full test sequence

### Step 1 — Register an agent

```bash
dolores register
```

- Select a capability template (e.g. `1` for Jupiter Trader)
- Confirm registration
- Note the **Agent pubkey** printed at the end

The agent keypair is saved to `~/.dolores/agents/<pubkey>.json`.
The capability manifest is saved to `~/.dolores/agents/<pubkey>.manifest.json`.

### Step 2 — Check initial reputation

```bash
dolores history --agent-id <AGENT_PUBKEY>
```

Expected: `Reputation: 0 / 10000`, `Last attested: never`

### Step 3 — Fund the agent

Go to https://faucet.solana.com, paste the agent pubkey, request **1 SOL** on devnet.

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

### Step 5 — Verify reputation updated

```bash
dolores history --agent-id <AGENT_PUBKEY>
```

Expected: `Reputation: 42 / 10000`, `Last attested: <timestamp>`

### Step 6 — Run more tasks to build reputation

```bash
dolores run --agent-id <AGENT_PUBKEY> --recipient <ANY_PUBKEY> --amount 0.01
dolores run --agent-id <AGENT_PUBKEY> --recipient <ANY_PUBKEY> --amount 0.01
dolores history --agent-id <AGENT_PUBKEY>
```

Each run adds 42 reputation points.

---

## 4. Security test — invalid signature rejection

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

Only the agent that holds the private key can submit valid receipts for that agent ID.

---

## 5. API endpoints

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/receipts/upload` | Submit execution receipt — triggers on-chain attestation |
| `GET` | `/receipts/:taskId` | Fetch a receipt by task ID |
| `GET` | `/receipts/agent/:agentId` | Fetch all receipts for an agent |
| `POST` | `/receipts/attest/retry` | Retry any receipts that missed attestation |
| `GET` | `/agents/:agentId` | Fetch live on-chain reputation for an agent |

---

## 6. CLI commands

| Command | Status | What it does |
|---|---|---|
| `dolores register` | ✅ Live | Generate agent keypair + register on-chain |
| `dolores history --agent-id <pubkey>` | ✅ Live | Fetch on-chain reputation |
| `dolores run --agent-id <pubkey>` | ✅ Live | Run a SOL transfer task + submit attestation |
| `dolores stake --agent-id <pubkey> --amount <usdc>` | ⬜ Soon | Stake USDC — requires `dolores_fund` |
| `dolores verify --agent-id <pubkey>` | ⬜ Soon | Verify agent meets thresholds — requires `dolores_fund` |
| `dolores challenge --agent-id <pubkey>` | ⬜ Soon | File a challenge — requires `dolores_adjudication` |

---

## 7. How reputation works

Each completed task earns an attestation. The reputation delta per task is:

```
delta = score × stake_weight / 10
      = 85    × 5            / 10
      = 42 points
```

Maximum reputation is **10,000**. It takes roughly 238 successful tasks to reach max reputation at default settings.

A slash drops reputation to **35% of its prior value** and increments `slash_count` permanently. Three slashes effectively blacklists the agent from any protocol using standard thresholds.

---

## 8. On-chain program

- **Program ID:** `DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd`
- **Network:** Solana devnet
- **Explorer:** https://explorer.solana.com/address/DMzRtZS76zs6ERgJdFKmjx3mVG66DzChLdEEtLzrVWvd?cluster=devnet

---

## 9. Architecture overview

```
dolores register
  → generates agent keypair
  → sends dual-sig tx (operator + agent)
  → creates RegistryAccount PDA on-chain

dolores run
  → agent transfers SOL on devnet
  → builds execution receipt JSON
  → sha256(receipt) = output_hash
  → agent signs output_hash with its keypair
  → POST /receipts/upload { agentId, taskId, outputHash, timestamp, agentSignature }
  → indexer verifies ed25519 signature
  → indexer calls submit_attestation on dolores_registry
  → reputation_score += 42
  → RegistryAccount PDA updated on-chain

dolores history
  → GET /agents/:agentId
  → indexer fetches RegistryAccount PDA from Solana RPC
  → returns live on-chain reputation data
```
