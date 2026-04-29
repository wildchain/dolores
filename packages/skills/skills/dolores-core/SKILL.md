---
name: dolores-core
description: >
  Core primitives for building accountable AI agents on Solana using the
  Dolores Protocol. Covers agent registration, staking, task lifecycle,
  execution receipts, output_hash signing, and verify_agent() CPI patterns
  for DeFi protocol integration.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - agent-registration
  - staking
  - slashing
  - reputation
  - execution-receipt
  - verify-agent
---

# Dolores Core

Core accountability primitives for any AI agent on Solana.

**On-chain programs (devnet)**

| Program | ID |
|---|---|
| `dolores_registry` | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` |
| `dolores_fund` | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` |
| `dolores_adjudication` | `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz` |

---

## Use / Do Not Use

**Use when:**
- Building an AI agent that executes on-chain actions with real funds
- A DeFi protocol needs to verify an agent before granting access
- You want automatic slashing when an agent misses a deadline or acts out of scope
- You need a portable, on-chain reputation record for an agent

**Do not use when:**
- The task is purely read-only (no funds moved, no state changed)
- You are building a UI with no agent execution logic

---

## Developer Quickstart

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as crypto from 'crypto';
import * as nacl from 'tweetnacl';

const REGISTRY_PROGRAM_ID   = '8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt';
const FUND_PROGRAM_ID       = 'AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5';
const ADJ_PROGRAM_ID        = '8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A';

const REGISTRY_SEED = Buffer.from('registry');
const FUND_SEED     = Buffer.from('fund');
const VAULT_SEED    = Buffer.from('vault');
const TASK_SEED     = Buffer.from('task');

// Derive all PDAs for a registered agent
function deriveAgentPDAs(operatorPubkey: PublicKey, agentPubkey: PublicKey) {
  const registryProgId = new PublicKey(REGISTRY_PROGRAM_ID);
  const fundProgId     = new PublicKey(FUND_PROGRAM_ID);

  const [registryPda] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED, agentPubkey.toBuffer()],
    registryProgId
  );
  const [fundPda] = PublicKey.findProgramAddressSync(
    [FUND_SEED, operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
    fundProgId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
    fundProgId
  );

  return { registryPda, fundPda, vaultPda };
}
```

---

## Capability Templates

Every agent registers with one or more capability templates. The template determines
which on-chain programs the agent is allowed to call. Attempting to call a program
outside the template results in an `OutOfScopeCall` slash.

| Template | Allowed Programs | Max Transfer |
|---|---|---|
| `SOL_TRANSFER` | System Program only | 1 SOL |
| `JUPITER_TRADER` | Jupiter v6, Jupiter Lend | 50,000 USDC |
| `RAYDIUM_LP` | Raydium AMM v4, CLMM, CPMM | 50,000 USDC |
| `ORCA_WHIRLPOOL` | Orca Whirlpools | 50,000 USDC |
| `KAMINO_LENDING` | Kamino Lending, Liquidity | 50,000 USDC |
| `METEORA_POOLS` | Meteora DLMM, LB CLMM, AMM | 50,000 USDC |
| `PYTH_ORACLE_READER` | Pyth oracle receiver, push | Read-only |

The `capability_hash` stored on-chain is `sha256(JSON.stringify(manifest, sortedKeys))`.

---

## Task Lifecycle

```
register_task(task_id, deadline, instruction)
    → TaskRecord PDA created
    → output_hash = [0u8; 32]  (zeroed — filled after execution)
    → status = Pending

[agent executes the task off-chain]

complete_task(output_hash)
    → output_hash = sha256(execution_receipt_json)
    → status = Completed
    → agent signs: ed25519(output_hash, agent_keypair)

[auto-watcher calls submit_attestation()]
    → reputation increments on-chain

[optional: challenger files challenge]
    → file_challenge(failure_type, proof_data)
    → fund locked, status = Challenged

auto_adjudicate()
    → MissedDeadline: checks TaskRecord.completed_at vs deadline on-chain
    → OutOfScopeCall: checks proof_data against capability manifest
    → Valid   → execute_slash() + record_slash() → status = Slashed
    → Invalid → unlock_fund()                    → status = Dismissed
```

---

## Execution Receipt

Every agent must produce a signed execution receipt after completing a task.
This is the agent's on-chain commitment to exactly what it did.

```typescript
interface ExecutionReceipt {
  schema_version: '1.0';
  task_id:        string;
  agent_id:       string;
  instruction:    string;   // the original goal from TaskRecord
  timestamp_unix: number;
  execution: {
    tx_signatures:         string[];   // all Solana tx sigs from this task
    programs_called:       string[];   // must match capability manifest
    instructions_executed: string[];
    token_transfers: Array<{
      mint:      string;
      amount:    number;
      direction: 'in' | 'out';
      from:      string;
      to:        string;
    }>;
  };
  result: {
    status:  'success' | 'failed';
    summary: string;
  };
}

// Hash the receipt → output_hash stored on-chain
function hashReceipt(receipt: ExecutionReceipt): Buffer {
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  return crypto.createHash('sha256').update(canonical).digest();
}

// Sign the hash → submitted with attestation
function signReceipt(outputHashBytes: Buffer, agentKeypair: Keypair): Buffer {
  return Buffer.from(
    nacl.sign.detached(outputHashBytes, agentKeypair.secretKey)
  );
}
```

**Independent verification (5 steps):**
1. Fetch receipt from Arweave using `arweave_cid` from RegistryAccount PDA
2. `sha256(receipt_json) == output_hash` → receipt is authentic
3. `ed25519_verify(agent_signature, output_hash, agent_pubkey)` → agent signed it
4. Look up `tx_signatures` on Solana RPC → transactions actually happened
5. `programs_called` matches actual tx instructions → agent reported honestly

---

## verify_agent() — DeFi Protocol Integration

Call this CPI before granting any agent access to a protocol.

```rust
// In your Anchor program
use dolores_registry::cpi::verify_agent;

let (trusted, _) = verify_agent(
    agent_id,
    min_reputation: 5000,      // 0–10000
    min_stake: 10_000_000,     // lamports (0.01 SOL)
)?;

if trusted {
    // grant pool access
} else {
    return Err(AgentNotTrusted)
}
// No account. No fee. No dashboard.
```

`verify_agent()` returns `true` if ALL three conditions are met:
- `reputation_score >= min_reputation`
- `declared_stake >= min_stake_lamports`
- `slash_count < 3` (not banned)

---

## Slash Economics

| Event | Effect |
|---|---|
| Valid challenge filed | Fund locked, status → Challenged |
| Slash executed | 60% to challenger, 40% to treasury |
| Reputation after slash | `score × 0.35` (permanent decay) |
| Slash count | `+1` — never resets |
| Banned at | `slash_count >= 3` |

Slash amounts: `DEFAULT_SLASH_LAMPORTS = 100_000_000` (0.1 SOL)

---

## Gotchas

- `output_hash` is zeroed at `register_task()` — only written by `complete_task()`
- `complete_task()` rejects `[0u8; 32]` — agent must provide a real sha256 hash
- `withdraw_stake()` is blocked while `challenge_active = true` on FundAccount
- `claim_rewards()` enforces a 7-day epoch cooldown per StakerPosition
- Slash accounting is **lazy** — `apply_slash_to_staker()` must be called before
  a staker withdraws or claims after a slash event
- `instruction` max length is 256 bytes on-chain
- Agent cannot challenge its own task (`AgentCannotChallenge` error)