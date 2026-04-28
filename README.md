# Dolores Protocol

**AI agent accountability infrastructure on Solana.**

Dolores makes agent failure expensive — automatically, permanently, and without a central authority. Economic staking, automatic slashing, and on-chain reputation combine into a trust layer for the Solana agent ecosystem.

---

## What's in this monorepo

```
dolores/
├── apps/
│   ├── api/         NestJS API for the frontend (auth, agents, tasks, challenges, sync)
│   ├── client/      Next.js frontend (dashboard, explorer, register, staker, tasks)
│   ├── indexer/     NestJS indexer (handles /receipts/upload + on-chain attestation)
│   ├── agent/       Autonomous agent runtime (polling, Claude-powered task execution)
│   └── cli/         Operator/user CLI (register, stake, assign, history, challenge)
│
├── packages/
│   ├── shared/         DTOs and entity interfaces shared across apps
│   ├── contracts/      Anchor program IDLs and program IDs
│   ├── solana-utils/   Keypair loading + signature verification
│   └── database/       RocksDB wrapper for cache layer
│
├── dolores-programs/   Anchor programs (registry, fund, adjudication)
└── dolores-skills/     Claude Code skills for agent instrumentation
```

---

## On-Chain Programs (Solana Devnet)

| Program | Address |
|---|---|
| `dolores_registry` | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` |
| `dolores_fund` | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` |
| `dolores_adjudication` | `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz` |

---

## Quick Start

### Prerequisites

- Node.js 18+, pnpm 8+
- Solana CLI + a devnet wallet keypair at `~/.config/solana/id.json`
- Devnet SOL — get it at https://faucet.solana.com
- PostgreSQL (for the legacy indexer) and/or RocksDB (auto-created by API)
- Anthropic API key — set `ANTHROPIC_API_KEY` in `apps/agent/.env`

### Install everything

```bash
pnpm install
```

### Run the stack (one terminal per service)

```bash
# Terminal 1 — API (port 3001, serves the frontend)
pnpm dev:api

# Terminal 2 — Indexer (port 8080, handles receipt uploads and on-chain attestation)
pnpm dev:indexer

# Terminal 3 — Frontend (port 5173)
pnpm dev:client

# Terminal 4 — Agent runtime
cd apps/agent
cp .env.example .env  # set ANTHROPIC_API_KEY and AGENT_ID
pnpm dev

# Terminal 5 — CLI (one-off commands)
cd apps/cli
pnpm build
node dist/src/index.js register
```

---

## Capability Templates

| Template | Allowed Programs | Max Transfer |
|---|---|---|
| `SOL_TRANSFER` | System Program only | 1 SOL |
| `JUPITER_TRADER` | Jupiter v6 + Lend | 50,000 USDC |
| `RAYDIUM_LP` | Raydium AMM v4, CLMM, CPMM | 50,000 USDC |
| `KAMINO_LENDING` | Kamino Lending, Liquidity | 50,000 USDC |
| `METEORA_POOLS` | Meteora DLMM, AMM | 50,000 USDC |
| `PUMPFUN_TRADER` | PumpFun bonding curve | 1 SOL per buy |
| `PYTH_ORACLE_READER` | Pyth Hermes (off-chain) | Read-only |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     User / Operator                       │
└──────────────┬─────────────────────────┬──────────────────┘
               │                         │
       ┌───────▼────────┐        ┌───────▼────────┐
       │  apps/client   │        │   apps/cli     │
       │  (Next.js)     │        │  (commander)   │
       └───────┬────────┘        └───────┬────────┘
               │                         │
               │ HTTP                    │ direct
               │                         │ on-chain
       ┌───────▼────────┐                │
       │  apps/api      │                │
       │  (NestJS, 3001)│                │
       │   ├ auth       │                │
       │   ├ agents     │                │
       │   ├ tasks      │                │
       │   ├ challenges │                │
       │   └ sync ◄─────┼──── reads on-chain events
       └───────┬────────┘                │
               │                         │
               │  RocksDB cache          │
               │                         │
┌──────────────▼─────────────────────────▼──────────────────┐
│              Solana Devnet Programs                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │   registry   │ │     fund     │ │  adjudication    │   │
│  │              │ │              │ │ register_task    │   │
│  │ submit_atte  │ │ stake        │ │ complete_task    │   │
│  │ verify_agent │ │ withdraw     │ │ file_challenge   │   │
│  └──────▲───────┘ └──────────────┘ └────────▲─────────┘   │
│         │                                    │             │
└─────────┼────────────────────────────────────┼─────────────┘
          │                                    │
   ┌──────┴──────┐                      ┌──────┴──────┐
   │ apps/indexer │                     │ apps/agent  │
   │  port 8080   │                     │ (autonomous)│
   │  /receipts/  │                     │  polls      │
   │  upload      │                     │  Claude →   │
   │              │                     │  execute →  │
   │  → submit_   │                     │  receipt →  │
   │  attestation │                     │  complete_  │
   │              │                     │  task()     │
   └──────────────┘                     └─────────────┘
```

The agent runtime calls `complete_task()` on-chain. The API's `sync` service listens for the `TaskCompleted` event and updates the cache so the frontend reflects it in real time. The indexer separately handles receipt uploads and on-chain attestation.

---

## License

UNLICENSED
