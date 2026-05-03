---
name: pumpfun
description: >
  Dolores-accountable PumpFun skill. Use when building an agent with the
  PUMPFUN_TRADER capability template. Covers buy/sell on bonding curves with
  full Dolores accountability — output_hash signing, program enforcement, slashing.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - pumpfun
  - bonding-curve
  - meme-tokens
  - agent-accountability
---

# PumpFun Skill (Dolores-Accountable)

Dolores trust layer around PumpFun bonding curve buy/sell operations.

**Capability template**: `PUMPFUN_TRADER`
**Program**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

---

## Why Dolores + PumpFun?

Meme token trading is the highest-risk DeFi activity. Agents trading on behalf of users need accountability:
- Did the agent actually buy the token the user specified?
- Did it pay more than the user authorized (front-run itself)?
- Did it call any unexpected programs?

Dolores answers all of these via on-chain receipts, output_hash signing, and slashing.

---

## Supported Operations

| Operation | Scope |
|---|---|
| `buy` | Buy tokens from bonding curve with SOL |
| `sell` | Sell tokens back to bonding curve for SOL |
| `status` | Check bonding curve state (read-only) |
| PumpSwap liquidity | ❌ Out of scope for PUMPFUN_TRADER |
| Token creation | ❌ Out of scope for PUMPFUN_TRADER |

---

## Bonding Curve Math

PumpFun uses Uniswap V2 constant product: `x * y = k`

**Buy quote:**
```
netSol = solIn * 10000 / (10000 + feeBps)
tokensOut = netSol * virtualTokenReserves / (virtualSolReserves + netSol)
```

**Sell quote:**
```
grossSol = tokensIn * virtualSolReserves / (virtualTokenReserves + tokensIn)
netSol = grossSol * (10000 - feeBps) / 10000
```

Default fee: 100 bps (1%)

---

## PDAs

```typescript
// Bonding curve
seeds: ["bonding-curve", mint.toBuffer()]

// Associated bonding curve (token account)
seeds: ["associated-bonding-curve", mint.toBuffer()]

// Creator vault
seeds: ["creator-vault", creator.toBuffer()]

// Global config
seeds: ["global"]

// Fee config
seeds: ["fee_config"] on PUMP_FEES program
```

---

## Account Extension

Always check bonding curve account size before buy/sell:
- If `data.length < 150`: prepend `extendAccount` instruction
- Pool accounts: check `data.length < 300` for PumpSwap

---

## Dolores Accountability Rules

1. **Only call Pump Program** — any other program = `OutOfScopeCall` slash
2. **Max 0.1 SOL per buy** without elevated trust level
3. **Always verify bonding curve not complete** before trading
4. **Sign receipt after every operation** — unsigned = protocol violation
5. **Never trade graduated tokens** on bonding curve (use PumpSwap)

---

## Error Codes

| Code | Name | Action |
|---|---|---|
| 6001 | TooMuchSolRequired | Increase slippage |
| 6003 | BondingCurveNotComplete | Cannot migrate yet |
| 6005 | BondingCurveComplete | Use PumpSwap instead |
| 6008 | InvalidAmount | Check token amount |