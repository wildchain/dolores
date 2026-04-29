---
name: jupiter-trader
description: >
  Dolores-accountable Jupiter swap skill. Use when building an agent with the
  JUPITER_TRADER capability template. Covers swap execution, receipt generation,
  and on-chain commitment. Wraps the Jupiter Swap v2 API with full Dolores
  accountability — execution receipts, output_hash signing, and automatic
  slashing for out-of-scope calls.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - jupiter
  - swap
  - defi
  - agent-accountability
---

# Jupiter Trader Skill (Dolores-Accountable)

Dolores trust layer wrapped around Jupiter Swap v2.

**Capability template**: `JUPITER_TRADER`
**Allowed programs**: Jupiter v6 (`JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`) and Jupiter Lend
**Max transfer**: 50,000 USDC equivalent per task

**Prerequisites**:
- `JUPITER_API_KEY` from [portal.jup.ag](https://portal.jup.ag)
- Agent registered with `JUPITER_TRADER` capability template
- Agent wallet funded with SOL for gas

---

## Use / Do Not Use

**Use when:**
- Instruction asks to swap, exchange, or convert tokens on Solana
- Agent is registered with `JUPITER_TRADER` capability template

**Do not use when:**
- Instruction involves programs outside the Jupiter allowlist
- Amount exceeds 50,000 USDC equivalent
- Input/output mints are not on Jupiter's verified token list

---

## Intent Router

| Instruction contains | Action |
|---|---|
| "swap X SOL to USDC" | Parse → execute → receipt |
| "exchange X token for Y token" | Parse → execute → receipt |
| "buy X USDC with SOL" | Parse → execute → receipt |
| Anything outside Jupiter programs | Reject immediately |
| Amount > 50,000 USDC equivalent | Reject — exceeds capability limit |

---

## Quickstart

```typescript
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import * as nacl from 'tweetnacl';

const BASE    = 'https://api.jup.ag';
const API_KEY = process.env.JUPITER_API_KEY!;

const SOL_MINT  = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

async function jupiterFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': API_KEY,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Step 1: Get swap order ─────────────────────────────────────────────────

async function getSwapOrder(params: {
  inputMint:  string;
  outputMint: string;
  amount:     number; // in lamports or token base units
  taker:      string; // agent wallet pubkey
}) {
  const query = new URLSearchParams({
    inputMint:  params.inputMint,
    outputMint: params.outputMint,
    amount:     params.amount.toString(),
    taker:      params.taker,
  });

  return jupiterFetch<{
    transaction: string | null;
    requestId:   string;
    router?:     string;
    feeBps?:     number;
    error?:      string;
  }>(`/swap/v2/order?${query}`);
}

// ── Step 2: Sign transaction ───────────────────────────────────────────────

function signTransaction(txBase64: string, agentKeypair: Keypair): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));
  tx.sign([agentKeypair]);
  return Buffer.from(tx.serialize()).toString('base64');
}

// ── Step 3: Execute swap ───────────────────────────────────────────────────

async function executeSwap(signedTx: string, requestId: string) {
  return jupiterFetch<{
    status:             string;
    signature:          string;
    code:               number;
    inputAmountResult?: string;
    outputAmountResult?: string;
    error?:             string;
  }>('/swap/v2/execute', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTx, requestId }),
  });
}

// ── Step 4: Build execution receipt ───────────────────────────────────────

function buildReceipt(params: {
  taskId:      string;
  agentId:     string;
  instruction: string;
  inputMint:   string;
  outputMint:  string;
  inputAmount: string;
  outputAmount: string;
  txSignature: string;
  timestamp:   number;
}) {
  return {
    schema_version: '1.0',
    task_id:        params.taskId,
    agent_id:       params.agentId,
    instruction:    params.instruction,
    timestamp_unix: params.timestamp,
    execution: {
      tx_signatures:         [params.txSignature],
      programs_called:       [JUPITER_V6],
      instructions_executed: ['swap'],
      token_transfers: [
        {
          mint:      params.inputMint,
          amount:    parseInt(params.inputAmount),
          direction: 'out' as const,
          from:      params.agentId,
          to:        JUPITER_V6,
        },
        {
          mint:      params.outputMint,
          amount:    parseInt(params.outputAmount),
          direction: 'in' as const,
          from:      JUPITER_V6,
          to:        params.agentId,
        },
      ],
    },
    result: {
      status:  'success' as const,
      summary: `Swapped ${params.inputAmount} of ${params.inputMint} → ${params.outputAmount} of ${params.outputMint}`,
    },
  };
}

// ── Step 5: Hash + sign receipt ───────────────────────────────────────────

function signReceipt(receipt: object, agentKeypair: Keypair) {
  const canonical      = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto.createHash('sha256').update(canonical).digest();
  const outputHash     = outputHashBytes.toString('hex');
  const signature      = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
  const agentSignature = Buffer.from(signature).toString('hex');
  return { outputHash, agentSignature };
}
```

---

## Claude Integration

Pass this skill as system prompt. Claude returns **only JSON**:

**Valid response:**
```json
{
  "action": "swap",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inputSymbol": "SOL",
  "outputSymbol": "USDC",
  "amountLamports": 1000000000,
  "amountSol": 1.0,
  "slippageBps": 50
}
```

**Rejected task:**
```json
{
  "action": "reject",
  "reason": "This agent is only authorised to call Jupiter programs."
}
```

---

## Gotchas

- Signed payloads expire in ~2 minutes — sign and execute immediately
- Re-quote before executing if conditions may have changed
- `programs_called` in receipt must only contain Jupiter program IDs
- Any other program in `programs_called` exposes agent to `OutOfScopeCall` slash
- `output_hash` must equal `sha256(canonical_receipt_json)`

---

## Error Handling

| Code | Meaning | Action |
|---|---|---|
| `-1` | Missing/expired cached order | Re-quote and retry |
| `-1000` | Failed landing | Re-quote with adjusted params |
| `-1004` | Invalid block height | Re-quote (stale blockhash) |
| `429` | Rate limited | Exponential backoff |
| `reject` | Out of scope | Mark task dismissed |