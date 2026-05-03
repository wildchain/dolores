---
name: raydium
description: >
  Dolores-accountable Raydium skill. Use when building an agent with the
  RAYDIUM_TRADER or RAYDIUM_LP capability template. Covers swaps via Trade API
  and CPMM/CLMM liquidity management with full Dolores accountability.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - raydium
  - swap
  - liquidity
  - agent-accountability
---

# Raydium Skill (Dolores-Accountable)

Dolores trust layer around Raydium AMM swap and liquidity operations.

**Capability templates**: `RAYDIUM_TRADER`, `RAYDIUM_LP`

## Programs

| Program | ID |
|---|---|
| CPMM | `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C` |
| CLMM | `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK` |
| AMM V4 | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` |

## APIs

| API | Base URL |
|---|---|
| Trade API | `https://transaction-v1.raydium.io` |
| Data API  | `https://api-v3.raydium.io` |

---

## Supported Operations

| Operation | Scope |
|---|---|
| `swap` | ✅ Swap tokens via Trade API |
| `add_liquidity` | ✅ Add liquidity to CPMM pool |
| `remove_liquidity` | ✅ Remove liquidity from CPMM pool |
| `status` | ✅ Read pool metrics |
| Anything else | ❌ Reject |

---

## Pool Types

**CPMM** — Best for most pairs. No OpenBook required. Token22 support.
**CLMM** — Concentrated liquidity. NFT positions. Higher capital efficiency.
**AMM V4** — Classic AMM + OpenBook orderbook. High TVL legacy pools.

### Default pools

| Pool | ID |
|---|---|
| SOL-USDC CPMM | `7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny` |
| SOL-USDC AMM  | `58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2` |

---

## Swap Flow (Trade API)

1. `GET /compute/swap-base-in` — get quote
2. `POST /transaction/swap-base-in` — build serialized transaction
3. Deserialize → sign with agent keypair → send

No SDK needed for swaps — pure HTTP.

---

## Dolores Accountability Rules

1. **Only call Raydium programs** — any other program = `OutOfScopeCall` slash
2. **Funds must stay in agent wallet** — no transfers to external wallets
3. **Sign receipt after every operation** — unsigned = protocol violation
4. **Max 10 SOL per swap** — larger swaps require elevated trust level

---

## Verified Tokens

| Symbol | Mint | Decimals |
|---|---|---|
| SOL  | `So11111111111111111111111111111111111111112` | 9 |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 |
| RAY  | `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R` | 6 |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd` | 5 |