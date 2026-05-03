---
name: meteora-dlmm
description: >
  Dolores-accountable Meteora DLMM liquidity skill. Use when building an agent
  with the METEORA_LP capability template. Covers adding/removing concentrated
  liquidity, swapping, and collecting fees — with full Dolores accountability.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - meteora
  - dlmm
  - liquidity
  - agent-accountability
---

# Meteora DLMM Skill (Dolores-Accountable)

Dolores trust layer around Meteora DLMM concentrated liquidity operations.

**Capability template**: `METEORA_LP`
**Program**: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
**Default pool**: SOL/USDC 25bps — `FoSDw2L5DmTuQTFe55gWPDXf88euaxAEKFre74CnvQbX`

---

## Prerequisites

```bash
npm install @meteora-ag/dlmm @coral-xyz/anchor
```

---

## Supported Operations

| Operation | Instruction contains | Scope |
|---|---|---|
| `add_liquidity` | "add liquidity", "provide", "deposit" | ✅ Allowed |
| `remove_liquidity` | "remove", "withdraw liquidity" | ✅ Allowed |
| `swap` | "swap", "exchange" | ✅ Allowed |
| `collect_fees` | "collect fees", "claim fees" | ✅ Allowed |
| `status` | "check", "position", "status" | ✅ Allowed |
| Anything else | lending, staking, etc. | ❌ Reject |

---

## Known SOL/USDC Pools

| Pool | Fee | Address |
|---|---|---|
| SOL-USDC-1   | 1bps   | `HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ` |
| SOL-USDC-5   | 5bps   | `3W2HKgUa96Z69zzucHMFGPxRQsNZMdngQp3XJbhVEFyR` |
| SOL-USDC-25  | 25bps  | `FoSDw2L5DmTuQTFe55gWPDXf88euaxAEKFre74CnvQbX` |
| SOL-USDC-100 | 100bps | `AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9jpTUAApCYw4enx` |

---

## Key Concepts

**Bins** — DLMM uses discrete price bins instead of a continuous curve. Each bin has a specific price.

**Active bin** — The bin containing the current market price. Fees are only earned when price is in your range.

**Strategy types**:
- `SpotBalanced` — equal distribution across bins (default)
- `CurveBalanced` — bell curve around active bin
- `BidAsk` — concentrated at edges

**binRange** — Number of bins on each side of active bin. Default 10. Wider = less concentrated, more stable.

---

## Dolores Accountability Rules

1. **Only call Meteora DLMM program** — any other program = `OutOfScopeCall` slash
2. **Never remove liquidity to a different wallet** — funds must return to agent wallet
3. **Sign receipt after every operation** — unsigned = protocol violation
4. **Max position size**: 100 SOL equivalent per operation

---

## Error Handling

| Error | Cause | Action |
|---|---|---|
| `InsufficientBalance` | Not enough tokens | Check wallet balance |
| `PositionNotFound` | No open position | Add liquidity first |
| `InvalidPool` | Wrong pool address | Use verified pool list |
| `SlippageTooHigh` | Price moved too much | Retry or increase slippage |