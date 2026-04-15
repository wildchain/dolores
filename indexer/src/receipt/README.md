# Receipt Module

The Receipt Module handles execution receipt storage and verification for the Dolores accountability layer.

## Architecture

```
Agent executes task
     ↓
withCluReceipt() generates ExecutionReceipt JSON
     ↓
POST /receipts/upload (full receipt)
     ↓
Compute output_hash = SHA256(canonical JSON)
     ↓
Upload full receipt to Arweave → get CID
     ↓
Store {agentId, taskId, outputHash, timestamp, cid} in SQLite
     ↓
Return CID to agent
```

## Components

### Entities

- **ReceiptEntity** - Database entity storing minimal receipt metadata + CID pointer

### Services

- **ReceiptService** - Database operations (CRUD for receipt metadata)
- **ReceiptIpfsService** - Arweave upload/retrieval & hash verification
- **ArweaveService** - Low-level Arweave wallet management & transactions

### Interfaces

- **ExecutionReceipt** - Full receipt structure matching technical spec
- **CreateReceiptDto** - Minimal fields for database storage

## API Endpoints

### `POST /receipts/upload`

Upload a full execution receipt to Arweave.

**Request Body:**

```json
{
  "schema_version": "1.0",
  "task_id": "7f3a9c...",
  "agent_id": "AgentPubkeyBase58...",
  "operator": "OperatorPubkeyBase58...",
  "assigned_by": "TraderPubkeyBase58...",
  "timestamp_unix": 1743724800,
  "execution": {
    "tx_signatures": ["5Kj8xVmN3..."],
    "programs_called": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "instructions_executed": ["swap"],
    "token_transfers": [
      { "mint": "EPjFWdd5...", "amount": 1000000, "direction": "out" }
    ]
  },
  "result": {
    "status": "success",
    "summary": "Swapped 1 USDC for 0.00523 SOL"
  }
}
```

**Response:**

```json
{
  "cid": "arweave_tx_id_here",
  "taskId": "7f3a9c...",
  "agentId": "AgentPubkeyBase58...",
  "outputHash": "sha256_hash_here"
}
```

### `GET /receipts/:taskId`

Retrieve full execution receipt from Arweave by task ID.

**Response:** Full ExecutionReceipt JSON

### `GET /receipts/agent/:agentId`

List all receipt metadata for an agent.

**Response:** Array of ReceiptEntity (metadata only, not full receipts)

### `GET /receipts/verify/:taskId`

Verify a receipt's hash matches what's stored in Arweave.

**Response:**

```json
{
  "taskId": "7f3a9c...",
  "cid": "arweave_tx_id",
  "verified": true,
  "outputHash": "sha256_hash"
}
```

## Output Hash Computation

The output hash is deterministic:

```typescript
const canonicalJson = JSON.stringify(receipt, Object.keys(receipt).sort());
const outputHash = sha256(canonicalJson).hex();
```

This ensures:

- Anyone can independently verify a receipt
- Agents cannot later deny what they executed
- Challengers can prove misbehavior cryptographically

## Database Schema

```sql
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agentId VARCHAR(255) NOT NULL,
  taskId VARCHAR(255) UNIQUE NOT NULL,
  outputHash VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL,
  cid VARCHAR(255),
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);

CREATE INDEX idx_receipts_taskId ON receipts(taskId);
CREATE INDEX idx_receipts_agentId ON receipts(agentId);
```

## Arweave Configuration

See [ARWEAVE_SETUP.md](../ARWEAVE_SETUP.md) for wallet configuration.

**Environment Variables:**

```
ARWEAVE_WALLET_PATH=./arweave-wallet.json  # Local dev
ARWEAVE_WALLET_JSON='{"kty":"RSA",...}'     # Production (use secrets manager)
ARWEAVE_HOST=arweave.net
ARWEAVE_PORT=443
ARWEAVE_PROTOCOL=https
```

## Security Considerations

1. **Never commit wallet keys** - They're in .gitignore
2. **Use testnet for development** - Set `ARWEAVE_HOST=testnet.redstone.tools`
3. **Rotate wallets** - Generate fresh wallets periodically in production
4. **Monitor balance** - Set up alerts for low AR balance
5. **Validate receipts** - Always verify output hash before trusting data

## Integration Example

```typescript
// Agent uploads receipt after task execution
const receipt: ExecutionReceipt = {
  schema_version: '1.0',
  task_id: taskId,
  agent_id: agentPubkey,
  // ... full receipt
};

const response = await fetch('http://localhost:3000/receipts/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(receipt),
});

const { cid, outputHash } = await response.json();

// Later: Challenger retrieves and verifies
const storedReceipt = await fetch(`http://localhost:3000/receipts/${taskId}`);
const verified = await fetch(`http://localhost:3000/receipts/verify/${taskId}`);
```

## Testing

```bash
# Start the server
pnpm run start:dev

# Upload a test receipt
curl -X POST http://localhost:3000/receipts/upload \
  -H "Content-Type: application/json" \
  -d @test-receipt.json

# Retrieve it
curl http://localhost:3000/receipts/<taskId>

# Verify hash
curl http://localhost:3000/receipts/verify/<taskId>
```
