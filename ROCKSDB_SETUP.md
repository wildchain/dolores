# RocksDB Setup - Complete

## ✅ What Was Done

### 1. **Installed RocksDB**

- Added `rocksdb` package to dependencies
- Removed PostgreSQL (`pg`) and TypeORM (`typeorm`) dependencies

### 2. **Created RocksDB Service** ([rocksdb.service.ts](indexer/src/lib/database/rocksdb.service.ts))

- Full-featured key-value store with JSON serialization
- Methods: `put`, `get`, `delete`, `getMany`, `scan`, `batch`, `exists`
- Automatic initialization on module load
- Database path: `data/dolores.db` (configurable via `ROCKSDB_PATH` env var)
- Optimized settings: 8MB cache, 4MB write buffer, compression enabled

### 3. **Created Base Entity Helpers** ([base-rocksdb.entity.ts](indexer/src/lib/database/base-rocksdb.entity.ts))

- `BaseRocksDBEntity` interface with `id`, `createdAt`, `updatedAt`
- `createEntity()` helper for new entities with automatic timestamps
- `updateEntity()` helper for updates with automatic `updatedAt`
- `compositeKey()` / `parseCompositeKey()` for multi-tenant keys

### 4. **Converted Receipt Entity**

- Changed from TypeORM `@Entity` to RocksDB interface
- Added key generation functions for multiple indexes:
  - Primary: `receipt:{taskId}`
  - By agent: `receipt:agent:{agentId}:{taskId}`
  - By status: `receipt:status:{status}:{taskId}`
- Batch writes ensure atomic updates across all indexes

### 5. **Converted Challenge Entity**

- Changed from TypeORM to RocksDB interface
- Added key generation functions:
  - Primary: `challenge:{taskId}`
  - By agent: `challenge:agent:{agentId}:{taskId}`
  - By reviewer: `challenge:reviewer:{reviewerId}:{taskId}`

### 6. **Updated All Services**

- `ReceiptService` now uses `RocksDBService` instead of TypeORM Repository
- `ChallengeService` now uses `RocksDBService`
- All CRUD operations converted to RocksDB key-value operations
- Multi-index updates use batch operations for atomicity

### 7. **Updated Modules**

- Removed `TypeOrmModule` from `app.module.ts`
- Added `RocksDBService` as global provider
- Updated `ReceiptModule` and `ChallengeModule` to inject `RocksDBService`

---

## 📊 Data Storage Architecture

### On-Chain (Solana) - Commitments Only

```
Cost: ~$0.30 per attestation

RegistryAccount (204 bytes):
├─ reputation_score: u16
├─ slash_count: u8
├─ pending_attestation_count: u16
└─ challenged_attestation_count: u16

PendingAttestation (190 bytes):
├─ output_hash: [u8; 32]        ← Receipt hash for integrity
├─ evidence_cid: String         ← Arweave pointer
└─ status: u8                   ← Pending/Approved/Slashed

ChallengeAccount (181 bytes):
├─ violation_hash: [u8; 32]     ← Violation proof hash
└─ evidence_cid: String         ← Arweave evidence pointer
```

### Off-Chain (RocksDB) - Full Data & Indexes

```
Cost: Pennies on your server

ReceiptEntity:
├─ agentId, taskId, outputHash, timestamp
├─ cid (Arweave CID for full ExecutionReceipt)
├─ status: Received → PendingReview → Approved/Slashed
├─ pendingAttestationPda, submissionTx
├─ approvalTx, challengeTx, reviewerId
└─ verificationOutcome (full violation details)

ChallengeEntity:
├─ taskId, agentId, reviewerId
├─ violationHash, evidenceCid
├─ pendingAttestationPda, challengeTx
└─ status: Submitted/Failed

Indexes for fast queries:
├─ By task ID (primary key)
├─ By agent ID (list all agent's receipts)
├─ By status (find pending submissions/reviews)
├─ By reviewer ID (challenge history)
```

### On Arweave - Permanent Evidence

```
Cost: One-time upload (~$0.001 per receipt)

ExecutionReceipt (full JSON):
├─ task_id, agent_id, operator, assigned_by
├─ operation_type, operation_details
├─ execution:
│   ├─ tx_signatures: ["sig1", "sig2", ...]
│   ├─ programs_called: [program IDs]
│   ├─ instructions_executed: [instruction data]
│   └─ token_transfers: [mint, amount, direction]
└─ result: { status, summary }
```

---

## 🚀 Usage

### Install Dependencies

```bash
cd indexer
pnpm install
```

### Run the Indexer

```bash
# Development
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

### Data Directory

- Default: `./data/dolores.db`
- Configure via env: `ROCKSDB_PATH=/path/to/db`

---

## 🔑 Key Design Decisions

### Why RocksDB over PostgreSQL?

**Performance:**

- Key-value access is 10-100x faster than SQL queries
- No query planning overhead
- Optimal for receipt lookups by taskId

**Simplicity:**

- No schema migrations needed
- No ORM complexity
- Direct JSON serialization

**Cost:**

- No database server to manage
- No cloud DB fees
- Embedded database runs in-process

**Scalability:**

- Handles millions of receipts easily
- Write throughput > 100k/sec
- Read throughput > 500k/sec

### Why Multiple Indexes?

RocksDB is key-value only, so we denormalize data for fast queries:

**Primary Index** (`receipt:{taskId}`)

- Fast lookup by task ID (most common)

**Agent Index** (`receipt:agent:{agentId}:{taskId}`)

- List all receipts for an agent
- Sorted by task ID (chronological)

**Status Index** (`receipt:status:{status}:{taskId}`)

- Find all pending submissions
- Find all pending reviews
- Filter by lifecycle state

**Trade-off:** Extra writes on updates, but reads are instant (no table scans).

### Why Batch Operations?

When updating receipt status:

1. Update primary key
2. Delete old status index
3. Create new status index
4. Update agent index

All four operations must succeed or fail together. RocksDB batch writes ensure atomicity.

---

## 📝 Environment Variables

No database config needed! RocksDB is embedded. Optional:

```env
# Optional: Custom database path
ROCKSDB_PATH=/custom/path/to/db

# Solana config (unchanged)
SOLANA_RPC_URL=https://api.devnet.solana.com
DOLORES_IDL_PATH=/path/to/dolores_registry.json
REVIEWER_KEYPAIR_PATH=~/.config/solana/id.json
```

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# Test receipt lifecycle
curl -X POST http://localhost:8080/receipts/upload \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AgentPubkey...",
    "taskId": "task-123",
    "outputHash": "0xabc...def",
    "timestamp": 1745184000000,
    "agentSignature": "signature..."
  }'

# Query receipt
curl http://localhost:8080/receipts/task-123

# Query all agent receipts
curl http://localhost:8080/receipts/agent/AgentPubkey...
```

---

## 🎯 Benefits Summary

✅ **No PostgreSQL dependency** - One less service to run  
✅ **Faster queries** - Key-value access is instant  
✅ **Lower costs** - No cloud database fees  
✅ **Simpler deployment** - Just copy `data/` folder  
✅ **Better for this use case** - Receipt storage is naturally key-value  
✅ **Atomic updates** - Batch operations ensure consistency  
✅ **JSON-native** - No ORM mapping overhead

**Perfect fit for:**

- Receipt storage by taskId
- Agent query by agentId
- Status filtering for pending work
- Challenge history tracking
