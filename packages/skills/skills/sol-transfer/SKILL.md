---
name: sol-transfer
description: >
  Dolores skill for native SOL transfers via System Program. Use when building
  an agent with the SOL_TRANSFER capability template. Covers task parsing,
  execution, receipt generation, and on-chain commitment. This agent can ONLY
  call System Program — any other program is an out-of-scope violation.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - sol-transfer
  - system-program
  - agent-accountability
---

# SOL Transfer Skill

Dolores-accountable native SOL transfers via System Program.

**Capability template**: `SOL_TRANSFER`
**Allowed program**: `11111111111111111111111111111111` (System Program only)
**Max transfer**: 1 SOL per task

---

## Use / Do Not Use

**Use when:**
- The task instruction asks to transfer or send SOL to a wallet
- The agent is registered with the `SOL_TRANSFER` capability template

**Do not use when:**
- The instruction involves token swaps, DeFi, NFTs, or any other program
- The recipient is not a valid Solana base58 public key
- The amount exceeds 1 SOL

---

## Intent Router

| Instruction contains | Action |
|---|---|
| "transfer X SOL to \<pubkey\>" | Parse → execute → receipt |
| "send X SOL to \<pubkey\>" | Parse → execute → receipt |
| Anything involving Jupiter, swap, token, NFT, DeFi | Reject immediately |
| Amount > 1 SOL | Reject — exceeds capability limit |
| Invalid pubkey | Reject — cannot execute safely |

---

## Quickstart

```typescript
import {
  Connection, Keypair, PublicKey,
  SystemProgram, Transaction, sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as crypto from 'crypto';
import * as nacl from 'tweetnacl';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const MAX_SOL        = 1.0;
const MAX_LAMPORTS   = MAX_SOL * LAMPORTS_PER_SOL;

//  Step 1: Parse instruction 

interface TransferParams {
  recipient:      string;
  amountSol:      number;
  amountLamports: number;
}

// This parsing is done by Claude using the skill context.
// Claude returns structured JSON — never raw text.
// See "Claude Integration" section below.

//  Step 2: Validate 

function validateTransfer(params: TransferParams): void {
  // Pubkey length check (base58, 32–44 chars)
  if (params.recipient.length < 32 || params.recipient.length > 44) {
    throw new Error(`Invalid recipient pubkey: ${params.recipient}`);
  }
  // Amount bounds
  if (params.amountSol <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  if (params.amountLamports > MAX_LAMPORTS) {
    throw new Error(`Amount ${params.amountSol} SOL exceeds max ${MAX_SOL} SOL`);
  }
  // Pubkey parse check
  try {
    new PublicKey(params.recipient);
  } catch {
    throw new Error(`Invalid recipient pubkey: ${params.recipient}`);
  }
}

//  Step 3: Execute 

async function executeSolTransfer(
  connection: Connection,
  agentKeypair: Keypair,
  params: TransferParams,
): Promise<string> {
  validateTransfer(params);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: agentKeypair.publicKey,
      toPubkey:   new PublicKey(params.recipient),
      lamports:   params.amountLamports,
    })
  );

  return sendAndConfirmTransaction(connection, tx, [agentKeypair], {
    commitment: 'confirmed',
  });
}

//  Step 4: Build execution receipt 

function buildReceipt(params: {
  taskId:      string;
  agentId:     string;
  instruction: string;
  transfer:    TransferParams;
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
      programs_called:       [SYSTEM_PROGRAM],
      instructions_executed: ['transfer'],
      token_transfers: [{
        mint:      'SOL',
        amount:    params.transfer.amountLamports,
        direction: 'out' as const,
        from:      params.agentId,
        to:        params.transfer.recipient,
      }],
    },
    result: {
      status:  'success' as const,
      summary: `Transferred ${params.transfer.amountSol} SOL to ${params.transfer.recipient}`,
    },
  };
}

//  Step 5: Hash + sign receipt 

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

When using Claude to parse task instructions, pass this skill as the system
prompt. Claude returns **only JSON** — no explanation, no markdown fences.

**Valid response shape:**
```json
{
  "action": "transfer",
  "recipient": "<base58-pubkey>",
  "amountSol": 0.001,
  "amountLamports": 1000000
}
```

**Rejected task response shape:**
```json
{
  "action": "reject",
  "reason": "This agent is only authorised to perform SOL transfers via System Program."
}
```

**API call pattern:**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

async function parseInstruction(instruction: string) {
  const skill = fs.readFileSync('./skills/sol-transfer.md', 'utf-8');

  const response = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:     skill,
    messages:   [{ role: 'user', content: instruction }],
  });

  const text  = response.content.find(b => b.type === 'text')?.text ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
```

---

## Full Agent Loop

```typescript
async function runAgent(
  taskId:      string,
  instruction: string,
  agentKeypair: Keypair,
  connection:  Connection,
) {
  const timestamp = Math.floor(Date.now() / 1000);

  // 1. Claude parses instruction → structured JSON
  const decision = await parseInstruction(instruction);
  if (decision.action === 'reject') {
    throw new Error(`Task rejected: ${decision.reason}`);
  }

  // 2. Execute transfer
  const txSignature = await executeSolTransfer(connection, agentKeypair, decision);

  // 3. Build + sign receipt
  const receipt = buildReceipt({
    taskId,
    agentId:    agentKeypair.publicKey.toBase58(),
    instruction,
    transfer:   decision,
    txSignature,
    timestamp,
  });
  const { outputHash, agentSignature } = signReceipt(receipt, agentKeypair);

  // 4. complete_task() on-chain — stores output_hash permanently
  // (see dolores-core for complete_task() implementation)

  // 5. Submit receipt to indexer → triggers submit_attestation()
  await fetch('http://localhost:8080/receipts/upload', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId:        agentKeypair.publicKey.toBase58(),
      taskId,
      outputHash,
      timestamp,
      agentSignature,
    }),
  });

  return { txSignature, outputHash };
}
```

---

## Error Handling

| Error | Cause | Action |
|---|---|---|
| `Invalid recipient pubkey` | Malformed base58 address in instruction | Reject task |
| `Amount exceeds max 1 SOL` | Instruction asks for > 1 SOL | Reject task |
| `Task rejected` | Claude identified out-of-scope instruction | Mark dismissed |
| `Insufficient balance` | Agent wallet underfunded | Airdrop on devnet, fund on mainnet |
| `complete_task OutputHashEmpty` | Tried to store zeroed hash | Always hash receipt before calling |

---

## Gotchas

- Always call `validateTransfer()` before executing — never trust Claude output blindly
- `programs_called` in the receipt **must** be `['11111111111111111111111111111111']` only
- If any other program appears in `programs_called`, the agent is exposed to `OutOfScopeCall` slash
- Receipt canonical JSON uses **alphabetically sorted keys** — same manifest always produces same hash
- `output_hash` in the receipt and in `complete_task()` must match exactly