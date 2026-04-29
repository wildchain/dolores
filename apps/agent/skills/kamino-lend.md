---
name: kamino-lend
description: >
  Dolores-accountable Kamino lending skill. Use when building an agent with the
  KAMINO_LENDER capability template. Covers deposit, withdraw, borrow, repay,
  and health factor monitoring with full Dolores accountability — execution
  receipts, output_hash signing, and automatic slashing for out-of-scope calls.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - kamino
  - lending
  - defi
  - agent-accountability
---

# Kamino Lend Skill (Dolores-Accountable)

Dolores trust layer wrapped around Kamino Finance lending operations.

**Capability template**: `KAMINO_LENDER`
**Allowed program**: `KLend2g3cP87ber41qQDzWpAFuqP2tCxDqC8S3k7L1U`
**Main market**: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
**Max single operation**: 50,000 USDC equivalent

---

## Prerequisites

```bash
npm install @kamino-finance/klend-sdk decimal.js
```

**Environment**:
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## Supported Operations

| Operation | Instruction contains | Scope |
|---|---|---|
| `deposit` | "deposit", "supply", "add collateral" | ✅ Allowed |
| `withdraw` | "withdraw", "remove collateral" | ✅ Allowed |
| `borrow` | "borrow", "take loan" | ✅ Allowed |
| `repay` | "repay", "pay back", "return" | ✅ Allowed |
| `status` | "check", "health factor", "position" | ✅ Allowed (read-only) |
| Anything else | swaps, transfers, liquidations | ❌ Reject |

---

## Response Format

Claude returns **only JSON** — no explanation, no markdown.

**Deposit/Withdraw/Borrow/Repay:**
```json
{
  "action": "deposit",
  "token": "SOL",
  "amount": 0.1,
  "amountBase": "100000000"
}
```

**Status check:**
```json
{
  "action": "status"
}
```

**Rejected:**
```json
{
  "action": "reject",
  "reason": "one sentence reason"
}
```

---

## Verified Tokens

| Symbol | Mint | Decimals |
|---|---|---|
| SOL | `So11111111111111111111111111111111111111112` | 9 |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe` | 6 |
| mSOL | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So` | 9 |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | 9 |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd` | 5 |

---

## Quickstart

```typescript
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  PROGRAM_ID,
} from "@kamino-finance/klend-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import Decimal from "decimal.js";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";

const MAIN_MARKET   = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const KAMINO_LEND   = "KLend2g3cP87ber41qQDzWpAFuqP2tCxDqC8S3k7L1U";
const RPC_URL       = process.env.SOLANA_RPC_URL!;

// ── Load market ───────────────────────────────────────────────────────────────

async function loadMarket(connection: Connection): Promise<KaminoMarket> {
  const market = await KaminoMarket.load(connection, MAIN_MARKET);
  await market.loadReserves();
  return market;
}

// ── Deposit ───────────────────────────────────────────────────────────────────

async function depositCollateral(
  connection: Connection,
  agentKeypair: Keypair,
  token: string,
  amountBase: string
): Promise<string> {
  const market = await loadMarket(connection);

  const action = await KaminoAction.buildDepositTxns(
    market,
    amountBase,
    token,
    agentKeypair.publicKey,
    new VanillaObligation(PROGRAM_ID),
    300000,
    true,
    undefined,
    undefined,
    "confirmed"
  );

  const tx = new Transaction().add(
    ...action.setupIxs,
    ...action.lendingIxs,
    ...action.cleanupIxs
  );

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

async function withdrawCollateral(
  connection: Connection,
  agentKeypair: Keypair,
  token: string,
  amountBase: string | "max"
): Promise<string> {
  const market = await loadMarket(connection);

  const action = await KaminoAction.buildWithdrawTxns(
    market,
    amountBase,
    token,
    agentKeypair.publicKey,
    new VanillaObligation(PROGRAM_ID),
    300000,
    true,
    undefined,
    "confirmed"
  );

  const tx = new Transaction().add(
    ...action.setupIxs,
    ...action.lendingIxs,
    ...action.cleanupIxs
  );

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

// ── Borrow ────────────────────────────────────────────────────────────────────

async function borrowAsset(
  connection: Connection,
  agentKeypair: Keypair,
  token: string,
  amountBase: string
): Promise<string> {
  const market = await loadMarket(connection);

  const action = await KaminoAction.buildBorrowTxns(
    market,
    amountBase,
    token,
    agentKeypair.publicKey,
    new VanillaObligation(PROGRAM_ID),
    300000,
    true,
    false,
    undefined,
    undefined,
    "confirmed"
  );

  const tx = new Transaction().add(
    ...action.setupIxs,
    ...action.lendingIxs,
    ...action.cleanupIxs
  );

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

// ── Repay ─────────────────────────────────────────────────────────────────────

async function repayDebt(
  connection: Connection,
  agentKeypair: Keypair,
  token: string,
  amountBase: string | "max"
): Promise<string> {
  const market = await loadMarket(connection);

  const action = await KaminoAction.buildRepayTxns(
    market,
    amountBase,
    token,
    agentKeypair.publicKey,
    new VanillaObligation(PROGRAM_ID),
    300000,
    true,
    undefined,
    "confirmed"
  );

  const tx = new Transaction().add(
    ...action.setupIxs,
    ...action.lendingIxs,
    ...action.cleanupIxs
  );

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: "confirmed",
  });
}

// ── Get position ──────────────────────────────────────────────────────────────

async function getPosition(connection: Connection, wallet: PublicKey) {
  const market = await loadMarket(connection);
  await market.refreshAll();

  const obligation = await market.getUserVanillaObligation(wallet);
  if (!obligation) return null;

  const stats = obligation.refreshedStats;
  const healthFactor = stats.borrowedValue.gt(0)
    ? stats.borrowLimit.div(stats.borrowedValue).toNumber()
    : Infinity;

  return {
    totalDepositedUsd: stats.depositedValue.toFixed(2),
    totalBorrowedUsd:  stats.borrowedValue.toFixed(2),
    netValueUsd:       stats.netAccountValue.toFixed(2),
    borrowLimitUsd:    stats.borrowLimit.toFixed(2),
    healthFactor,
    isAtRisk:          healthFactor < 1.2,
  };
}

// ── Build + sign Dolores receipt ──────────────────────────────────────────────

function buildKaminoReceipt(params: {
  taskId:      string;
  agentId:     string;
  instruction: string;
  operation:   string;
  token:       string;
  amount:      string;
  txSignature: string;
  timestamp:   number;
}) {
  return {
    schema_version: "1.0",
    task_id:        params.taskId,
    agent_id:       params.agentId,
    instruction:    params.instruction,
    timestamp_unix: params.timestamp,
    execution: {
      tx_signatures:         [params.txSignature],
      programs_called:       [KAMINO_LEND],
      instructions_executed: [params.operation],
      token_transfers: [
        {
          token:     params.token,
          amount:    params.amount,
          operation: params.operation,
        },
      ],
    },
    result: {
      status:  "success",
      summary: `Kamino ${params.operation}: ${params.amount} ${params.token}`,
    },
  };
}

function signKaminoReceipt(receipt: object, agentKeypair: Keypair) {
  const canonical       = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto.createHash("sha256").update(canonical).digest();
  const outputHash      = outputHashBytes.toString("hex");
  const signature       = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
  return {
    outputHash,
    agentSignature: Buffer.from(signature).toString("hex"),
  };
}
```

---

## Health Factor Rules

| Health Factor | Status | Action |
|---|---|---|
| > 2.0 | Safe | Normal operations |
| 1.2 – 2.0 | Caution | Agent should warn |
| 1.0 – 1.2 | Danger | Agent must repay or add collateral |
| < 1.0 | Liquidation | Position will be liquidated |

---

## Dolores Accountability Rules

1. **Only call Kamino Lending program** — any other program call = `OutOfScopeCall` slash
2. **Max 50,000 USDC equivalent per operation** — exceeding = `CapExceeded` reject
3. **Health factor must stay above 1.1** — dropping below = agent must self-correct
4. **Never liquidate other users** — liquidation calls are out of scope for `KAMINO_LENDER`
5. **Sign receipt after every operation** — unsigned execution = protocol violation

---

## Error Handling

| Error | Cause | Action |
|---|---|---|
| `InsufficientCollateral` | Not enough collateral to borrow | Deposit more first |
| `BorrowLimitExceeded` | Reserve borrow cap reached | Try smaller amount |
| `HealthFactorTooLow` | Operation would risk liquidation | Repay debt first |
| `ObligationNotFound` | No position exists | Deposit first to create obligation |
| `ReserveNotFound` | Wrong token symbol | Use verified token list above |