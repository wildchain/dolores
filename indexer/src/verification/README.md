# Verification Module

The Verification Module validates execution receipts against capability templates to ensure AI agents follow their declared constraints and permissions.

## Overview

This module implements **off-chain verification** for the Dolores accountability layer. It checks that agent operations comply with:

- Operation type allowlists
- JSON schema validation
- Program whitelist enforcement
- Operation-specific constraints (slippage, collateral ratios, lock periods, etc.)
- Global constraints (transaction limits, deadlines, total exposure)

## Architecture

```
verification/
├── verification.module.ts           # NestJS module registration
├── verification.service.ts          # Main orchestration service
├── verification.controller.ts       # REST API endpoints
├── index.ts                         # Public exports
│
├── interfaces/
│   └── capability-template.interface.ts  # Type definitions
│
├── services/
│   ├── schema-validator.service.ts       # JSON schema validation
│   ├── constraint-checker.service.ts     # Constraint checking orchestration
│   └── transaction-analyzer.service.ts   # Solana RPC transaction analysis
│
└── validators/
    ├── swap.validator.ts                 # Swap-specific checks
    ├── borrow.validator.ts               # Borrow/supply checks
    ├── stake.validator.ts                # Staking checks
    └── transfer.validator.ts             # Transfer checks
```

## API Endpoints

### `POST /verification/verify`

Verify a receipt against a capability template.

**Request:**

```json
{
  "receipt": {
    "schema_version": "2.0",
    "task_id": "abc123",
    "agent_id": "AgentPubkey...",
    "operation_type": "swap",
    "operation_details": {
      "dex_protocol": "jupiter",
      "input_token": "SOL",
      "output_token": "USDC",
      "slippage_tolerance": 1.5,
      "actual_slippage": 1.2
    },
    "execution": {
      "tx_signatures": ["5Kj8x..."],
      "programs_called": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"]
    },
    "result": {
      "status": "success",
      "summary": "Swapped 1 SOL for 52.3 USDC"
    }
  },
  "templateId": "DEFI_FULL_V1"
}
```

**Response (Valid):**

```json
{
  "taskId": "abc123",
  "agentId": "AgentPubkey...",
  "templateId": "DEFI_FULL_V1",
  "valid": true
}
```

**Response (Violations Found):**

```json
{
  "taskId": "abc123",
  "agentId": "AgentPubkey...",
  "templateId": "DEFI_FULL_V1",
  "valid": false,
  "violations": [
    {
      "rule": "SWAP_SLIPPAGE_EXCEEDED",
      "expected": 1.5,
      "actual": 2.3,
      "severity": "critical",
      "proof": {
        "expected_output": 52500000,
        "actual_output": 51000000,
        "input_amount": 1000000000
      }
    }
  ]
}
```

### `POST /verification/batch`

Verify multiple receipts at once.

**Request:**

```json
{
  "receipts": [
    {
      /* receipt 1 */
    },
    {
      /* receipt 2 */
    }
  ],
  "templateId": "DEFI_FULL_V1"
}
```

**Response:**

```json
{
  "templateId": "DEFI_FULL_V1",
  "totalReceipts": 2,
  "results": {
    "task_id_1": { "valid": true },
    "task_id_2": { "valid": false, "violations": [...] }
  }
}
```

### `GET /verification/arweave/:cid/:templateId`

Verify a receipt fetched from Arweave (not yet implemented).

### `GET /verification/health`

Health check endpoint.

---

## Verification Flow

```
1. Load Capability Template
   ↓
2. Check Operation Allowed
   ↓
3. Validate JSON Schema
   ↓
4. Validate Program Whitelist
   ↓
5. Fetch On-Chain Transaction Data (optional)
   ↓
6. Check Operation-Specific Constraints
   ↓
7. Check Global Constraints
   ↓
8. Return Result
```

---

## Validation Rules

### Schema Validation

- **Rule**: `OPERATION_NOT_ALLOWED`
- **Severity**: Critical
- **Check**: `operation_type` is in `allowed_operations`

- **Rule**: `SCHEMA_VALIDATION_FAILED`
- **Severity**: Critical
- **Check**: `operation_details` matches operation schema

- **Rule**: `UNAUTHORIZED_PROGRAM`
- **Severity**: Critical
- **Check**: All `programs_called` are in `allowed_programs`

### Swap Constraints

- **Rule**: `SWAP_SLIPPAGE_EXCEEDED`
- **Severity**: Critical
- **Check**: `actual_slippage ≤ max_slippage_percent`

- **Rule**: `SWAP_ROUTE_HOPS_EXCEEDED`
- **Severity**: High
- **Check**: `route_hops ≤ max_route_hops`

- **Rule**: `SWAP_PRICE_IMPACT_EXCEEDED`
- **Severity**: Critical
- **Check**: `price_impact_percent ≤ max_price_impact_percent`

### Borrow Constraints

- **Rule**: `BORROW_COLLATERAL_RATIO_TOO_LOW`
- **Severity**: Critical
- **Check**: `collateral_ratio_percent ≥ min_collateral_ratio_percent`

- **Rule**: `BORROW_INTEREST_RATE_TOO_HIGH`
- **Severity**: High
- **Check**: `interest_rate_percent ≤ max_interest_rate_percent`

### Stake Constraints

- **Rule**: `STAKE_LOCK_PERIOD_EXCEEDED`
- **Severity**: High
- **Check**: `lock_period_seconds ≤ max_lock_period_seconds`

### Transfer Constraints

- **Rule**: `TRANSFER_RECIPIENT_NOT_WHITELISTED`
- **Severity**: Critical
- **Check**: `recipient` is in whitelist

### Global Constraints

- **Rule**: `MAX_TRANSACTION_LIMIT_EXCEEDED`
- **Severity**: Critical
- **Check**: `transaction_value_usdc ≤ max_single_transaction_usdc`

- **Rule**: `DEADLINE_REQUIRED`
- **Severity**: High
- **Check**: Transaction includes deadline timestamp

---

## Usage Example

```typescript
import { VerificationService } from './verification';

const verificationService = // inject via DI

const result = await verificationService.verifyReceipt(
  executionReceipt,
  'DEFI_FULL_V1'
);

if (!result.valid) {
  console.error('Violations found:', result.violations);
  // Submit challenge to on-chain adjudication
  await submitChallenge(result.violations[0]);
}
```

---

## Configuration

The module loads capability templates from:

```
../schemas/capability-templates/{templateId}.json
```

Solana RPC connection configured via:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## Future Enhancements

- [ ] Arweave receipt fetching
- [ ] Oracle price integration (Pyth/Switchboard)
- [ ] Merkle proof generation for challenges
- [ ] Challenge submission to `dolores_adjudication`
- [ ] Automated verification node daemon
- [ ] Verification result caching
- [ ] Multi-chain support

---

## Related Modules

- **Receipt Module** - Stores receipts and Arweave CIDs
- **Attestation Module** - Submits positive reputation updates
- **Agent Module** - Agent entity definitions

---

## Testing

```bash
# Unit tests
pnpm test verification

# Integration tests
pnpm test:e2e verification

# Test specific validator
pnpm test swap.validator.spec.ts
```

---

## Verification vs Attestation

| Aspect            | Attestation            | Verification            |
| ----------------- | ---------------------- | ----------------------- |
| **Purpose**       | Reward good work       | Detect violations       |
| **When**          | After successful task  | Continuous monitoring   |
| **Who**           | Protocol auto-watcher  | Anyone (permissionless) |
| **Result**        | Reputation ↑           | Challenge → Slash       |
| **On-chain call** | `submit_attestation()` | `submit_challenge()`    |

Both are necessary — attestation creates the positive feedback loop, verification creates the economic deterrent.
