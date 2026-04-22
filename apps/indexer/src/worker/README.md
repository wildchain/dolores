# Review Worker - Automated Attestation Review

## Overview

The Review Worker is a background service that automatically verifies and approves/challenges pending attestations submitted by agents.

## How It Works

### 1. **Cron Job** (Every 30 seconds)

```
@Cron(CronExpression.EVERY_30_SECONDS)
processPendingReviews()
```

### 2. **Processing Pipeline**

For each receipt in `pending_review` status:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Fetch full ExecutionReceipt from Arweave (via CID)  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Get agent's capability template ID                   │
│    (from on-chain RegistryAccount.arweave_cid)          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Run VerificationService.verifyReceipt()              │
│    • Load capability template                           │
│    • Validate operation allowed                         │
│    • Validate operation schema                          │
│    • Validate program whitelist                         │
│    • Check operation-specific constraints               │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
    ┌────────┐      ┌─────────┐
    │ VALID  │      │ INVALID │
    └───┬────┘      └────┬────┘
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Auto-Approve │  │Auto-Challenge│
│              │  │              │
│ • +100 rep   │  │ • Slash rep  │
│ • status=1   │  │ • status=2   │
└──────────────┘  └──────────────┘
```

## Services Used

### **ReviewWorkerService**

- Main orchestrator
- Polls `ReceiptService.findPendingReview()` every 30 seconds
- Coordinates verification and on-chain actions

### **ReceiptService**

- `findPendingReview()` - Query RocksDB for receipts with status `pending_review`
- `markApproved()` - Update receipt to `approved` status
- `markSlashed()` - Update receipt to `slashed` status

### **VerificationService**

- `verifyReceipt(receipt, templateId)` - Run full verification suite
- Returns `{valid: boolean, violations?: ConstraintViolation[]}`

### **AttestationService**

- `approveAttestation(receipt)` - Submit on-chain approval tx
  - Calls `approve_attestation` instruction
  - Adds +100 reputation to agent
  - Sets `PendingAttestation.status = 1`

### **ChallengeService**

- `submitChallenge({taskId, violationHash, evidenceCid})` - Submit on-chain challenge
  - Calls `challenge_attestation` instruction
  - Slashes agent reputation to 35%
  - Sets `PendingAttestation.status = 2`
  - Creates `ChallengeAccount` with violation evidence

## Configuration

### Environment Variables

```bash
# Reviewer keypair (signs approval/challenge txs)
REVIEWER_KEYPAIR_PATH=~/.config/solana/id.json

# Solana RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Program IDL
DOLORES_IDL_PATH=/path/to/dolores_registry.json

# RocksDB database path
ROCKSDB_PATH=./data/dolores.db
```

### Cron Schedule

Default: **Every 30 seconds**

To change, edit `@Cron()` decorator in `review-worker.service.ts`:

```typescript
@Cron(CronExpression.EVERY_MINUTE) // Every minute
@Cron(CronExpression.EVERY_10_SECONDS) // Every 10 seconds
@Cron('*/5 * * * * *') // Every 5 seconds (custom cron)
```

## Verification Rules

### Valid Receipt Criteria

1. **Operation Allowed**
   - Operation type exists in agent's capability template

2. **Schema Valid**
   - Operation details match expected schema
   - Required fields present

3. **Programs Whitelisted**
   - All called programs in `allowed_programs` list

4. **Constraints Met**
   - Slippage within limits
   - Amount within max transaction size
   - Deadline provided (if required)
   - Price within oracle bounds

### Auto-Challenge Triggers

Any of the following violations trigger auto-challenge:

- **Critical**: Operation not allowed, program not whitelisted
- **High**: Schema validation failed, excessive slippage
- **Medium**: Missing deadline, amount exceeds limit

## Logging

### Success

```
✅ Receipt task-123 APPROVED — tx: 5Kq...xyz
```

### Challenge

```
⚠️  Receipt task-456 CHALLENGED — violations: 2
Violation details: [
  {
    "rule": "EXCESSIVE_SLIPPAGE",
    "expected": "1.0%",
    "actual": "5.2%",
    "severity": "high"
  }
]
```

### Debug

```
Processing receipt task-789 from agent AgentPubkey...
Fetched mock receipt for task-789 from CID bafybei...
```

## Testing

### Manual Trigger

```bash
# Force process pending reviews
curl -X POST http://localhost:8080/receipts/attest/retry
```

### Query Pending Reviews

```bash
# Get all pending reviews (stored in RocksDB)
curl http://localhost:8080/receipts/pending
```

### Submit Test Receipt

```bash
curl -X POST http://localhost:8080/receipts/upload \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AgentPubkey...",
    "taskId": "task-test-001",
    "outputHash": "0xabc123...",
    "timestamp": 1745184000000,
    "agentSignature": "0xsig..."
  }'

# Worker will pick it up within 30 seconds
```

## Mock vs Production

### Current (Mock)

- `fetchReceiptFromArweave()` returns hardcoded swap receipt
- `getAgentTemplateId()` returns `"swap-basic-v1"`
- No actual Arweave fetch

### Production TODO

1. **Arweave Client**

   ```typescript
   import Arweave from 'arweave';

   const arweave = Arweave.init({
     host: 'arweave.net',
     port: 443,
     protocol: 'https',
   });

   const data = await arweave.transactions.getData(cid);
   return JSON.parse(data.toString());
   ```

2. **Template ID Lookup**
   ```typescript
   const registry = await program.account.registryAccount.fetch(registryPda);
   const templateCid = registry.arweaveCid;
   const template = await fetchFromArweave(templateCid);
   return template.template_id;
   ```

## Architecture Benefits

### Why Automated?

- **Fast verification**: Receipts reviewed within 30 seconds
- **Consistent enforcement**: No human bias or missed violations
- **24/7 operation**: Agents can submit receipts anytime
- **Scalable**: Handles hundreds of receipts per minute

### Why Separate Worker?

- **Non-blocking**: Upload API returns immediately
- **Retry logic**: Failed verifications can be retried
- **Resource isolation**: Heavy verification doesn't impact API
- **Monitoring**: Easy to track worker health separately

## Monitoring

### Health Check

```bash
curl http://localhost:8080/verification/health
```

### Metrics to Track

- Pending review queue size
- Average verification time
- Approval rate vs challenge rate
- Failed verification count

## Future Enhancements

1. **Parallel Processing**
   - Process multiple receipts concurrently
   - Worker pool with configurable concurrency

2. **Priority Queue**
   - High-value transactions verified first
   - VIP agents get faster reviews

3. **ML-Based Scoring**
   - Pre-filter obvious fraud before full verification
   - Learn from historical violations

4. **Dispute Resolution**
   - Allow agents to appeal challenges
   - Multi-reviewer consensus for edge cases
