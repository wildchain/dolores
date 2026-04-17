# CLU Protocol Schema System v2 - Composable Operations

Modular, composable schema system for verifying AI agent trading operations on Solana.

## Architecture Overview

```
schemas/
├── base/
│   └── execution-receipt.v2.schema.json    # Base receipt with operation_type discriminator
│
├── operations/                              # Atomic operation schemas (reusable)
│   ├── swap.schema.json
│   ├── limit_order.schema.json
│   ├── add_liquidity.schema.json
│   ├── remove_liquidity.schema.json
│   ├── stake.schema.json
│   ├── borrow.schema.json
│   ├── transfer.schema.json
│   ├── flash_loan.schema.json
│   ├── arbitrage.schema.json
│   └── liquidate.schema.json
│
├── capability-templates/                    # Composed from operations
│   ├── DEX_TRADER_V2.json                  # swap + limit_order
│   ├── LP_MANAGER_V1.json                  # add_liquidity + remove_liquidity
│   └── DEFI_FULL_V1.json                   # comprehensive (7 operations)
│
└── examples/
    ├── composable-receipt-example.ts       # Usage examples
    └── validation-example.ts               # Validation logic
```

## Key Concepts

### 1. Operation Type Discriminator

All receipts use `operation_type` to determine which operation schema validates `operation_details`:

```typescript
{
  "schema_version": "2.0",
  "operation_type": "swap",        // ← Discriminator
  "operation_details": {           // ← Validated against operations/swap.schema.json
    "dex_protocol": "jupiter",
    "slippage_tolerance": 1.0,
    // ...
  }
}
```

### 2. Composable Templates

Capability templates are **combinations of allowed operations**:

```json
{
  "template_id": "DEX_TRADER_V2",
  "allowed_operations": [
    {
      "operation_type": "swap",
      "schema_ref": "operations/swap.schema.json",
      "constraints": { "max_slippage_percent": 2.0 }
    },
    {
      "operation_type": "limit_order",
      "schema_ref": "operations/limit_order.schema.json",
      "constraints": { "max_order_spread_percent": 5.0 }
    }
  ]
}
```

### 3. Granular Permissions

Agents get **exactly the operations they need**:

- **DEX_TRADER_V2**: swap + limit_order
- **LP_MANAGER_V1**: add_liquidity + remove_liquidity + claim_rewards
- **DEFI_FULL_V1**: swap + add_liquidity + borrow + stake + transfer
- **Custom bots**: Any combination (e.g., swap + flash_loan + arbitrage)

---

## Operation Schemas

### swap.schema.json

**Verifiable Properties:**

- ✅ Slippage tolerance not exceeded
- ✅ Programs called are whitelisted DEXs
- ✅ Transfer amount within limits
- ✅ Route hops within limit
- ✅ Price impact acceptable
- ✅ Deadline met

**Fields:**

- `dex_protocol` - jupiter | orca | raydium | meteora | phoenix
- `input_token`, `output_token` - Token mint addresses
- `input_amount`, `output_amount` - Actual amounts transferred
- `expected_output` - Expected amount before slippage
- `slippage_tolerance`, `actual_slippage` - Slippage percentages
- `route_hops` - Number of hops in swap route
- `effective_price` - Execution price

### limit_order.schema.json

**Verifiable Properties:**

- ✅ Order price within market bounds
- ✅ Order size within limits
- ✅ Expiry timestamp valid
- ✅ Correct order book program
- ✅ Fee tier authorized

**Fields:**

- `order_book_program`, `order_book_address` - Order book location
- `base_token`, `quote_token` - Trading pair
- `side` - buy | sell
- `limit_price` - Order price
- `size` - Order size in base token
- `expiry_timestamp` - When order expires
- `order_id` - Unique order identifier

### add_liquidity.schema.json

**Verifiable Properties:**

- ✅ Pool program whitelisted
- ✅ Token ratio matches pool
- ✅ Minimum LP tokens received
- ✅ Price impact acceptable
- ✅ Pool liquidity threshold met

**Fields:**

- `pool_program`, `pool_address` - AMM pool location
- `token_a_mint`, `token_b_mint` - Pool tokens
- `token_a_amount`, `token_b_amount` - Deposited amounts
- `lp_token_mint` - LP token received
- `lp_tokens_received` - Actual LP tokens
- `min_lp_tokens` - Minimum acceptable (slippage protection)

### borrow.schema.json

**Verifiable Properties:**

- ✅ Collateral ratio maintained
- ✅ Borrow amount within limits
- ✅ Interest rate as expected
- ✅ Lending program whitelisted
- ✅ Liquidation threshold safe

**Fields:**

- `lending_program`, `lending_pool` - Protocol details
- `position_address` - User's position account
- `collateral_mint`, `collateral_amount` - Collateral details
- `borrow_mint`, `borrow_amount` - Borrow details
- `collateral_ratio` - Percentage (e.g., 150%)
- `interest_rate` - Annual rate percentage
- `health_factor` - Position health after borrow

### transfer.schema.json

**Verifiable Properties:**

- ✅ Recipient address whitelisted
- ✅ Transfer amount within limits
- ✅ Token mint authorized
- ✅ No prohibited addresses

**Fields:**

- `token_mint` - Token being transferred
- `amount` - Transfer amount
- `sender`, `recipient` - Wallet addresses
- `memo` - Optional transfer note

### flash_loan.schema.json

**Verifiable Properties:**

- ✅ Loan repaid in same transaction
- ✅ Fee paid correctly
- ✅ Protocol whitelisted
- ✅ Loan amount within limits

**Fields:**

- `protocol_program`, `protocol_address` - Flash loan provider
- `loan_mint`, `loan_amount` - Loan details
- `fee_paid`, `fee_bps` - Fee information
- `repaid_in_same_tx` - MUST be true
- `net_profit` - Profit after repayment

### liquidate.schema.json

**Verifiable Properties:**

- ✅ Target position actually underwater
- ✅ Liquidation bonus within protocol limits
- ✅ Collateral seized matches protocol
- ✅ Liquidator authorized (if restricted)

**Fields:**

- `lending_protocol` - Protocol being used
- `target_position`, `target_owner` - Liquidated position
- `collateral_mint`, `collateral_seized` - Collateral details
- `debt_mint`, `debt_repaid` - Debt repaid
- `liquidation_bonus` - Bonus percentage received
- `pre_liquidation_health_factor` - Must be < 1

### arbitrage.schema.json

**Verifiable Properties:**

- ✅ All DEX programs whitelisted
- ✅ Net profit positive
- ✅ Gas fees accounted for
- ✅ Max trades per tx limit

**Fields:**

- `dex_programs` - DEXs used in arbitrage
- `trades` - Array of trade details (dex, input/output tokens, amounts)
- `net_profit_usdc` - Final profit in USDC
- `gas_fee_usdc` - Gas costs
- `route` - Human-readable route description

---

## Capability Templates

### DEX_TRADER_V2

**Operations**: swap, limit_order

**Use Case**: Trading bot that executes market swaps and places limit orders

**Constraints**:

- Swap: 2% max slippage, 3 max hops, 1% max price impact
- Limit order: 5% max spread, 30 day max duration
- Global: 50k USDC max per transaction

**Programs**: Jupiter, Orca, Raydium, Phoenix

### LP_MANAGER_V1

**Operations**: add_liquidity, remove_liquidity, claim_rewards

**Use Case**: Liquidity provision and management bot

**Constraints**:

- Add liquidity: 100k USDC max deposit, 0.5% max price impact, 1% max ratio delta
- Remove liquidity: 0.1 USDC min withdrawal, 1% max slippage
- Global: 100 million USDC min pool liquidity

**Programs**: Orca, Raydium, Meteora

### DEFI_FULL_V1

**Operations**: swap, add_liquidity, remove_liquidity, borrow, supply, stake, transfer

**Use Case**: Comprehensive DeFi agent with multi-protocol access

**Constraints**:

- Swap: 1.5% max slippage
- Borrow: 150% min collateral ratio, 20% max interest rate
- Stake: 1 year max lock period
- Transfer: Recipient whitelist enabled
- Global: 100k USDC max per transaction, 500k USDC max total exposure

**Programs**: Jupiter, Orca, Raydium, Solend, MarginFi, Kamino

---

## Usage Examples

### Creating a Receipt

```typescript
import { ExecutionReceiptV2 } from './types';

const swapReceipt: ExecutionReceiptV2 = {
  schema_version: "2.0",
  task_id: "task_123",
  agent_id: "AgentPubkey...",
  operator: "OperatorPubkey...",
  assigned_by: "TraderPubkey...",
  timestamp_unix: 1743724800,
  operation_type: "swap",  // ← Determines validation schema

  execution: {
    tx_signatures: ["5Kj8x..."],
    programs_called: ["JUP6L..."],
    instructions_executed: ["swap"],
    token_transfers: [...]
  },

  result: {
    status: "success",
    summary: "Swapped 1 USDC for 0.00523 SOL"
  },

  operation_details: {  // ← Validated against operations/swap.schema.json
    dex_protocol: "jupiter",
    input_token: "EPjFW...",
    output_token: "So111...",
    input_amount: 1000000,
    output_amount: 5230000,
    expected_output: 5240000,
    slippage_tolerance: 1.0,
    actual_slippage: 0.19,
    route_hops: 1
  }
};
```

### Validating Against Capability

```typescript
async function validateReceipt(
  receipt: ExecutionReceiptV2,
  agentCapability: CapabilityTemplate,
): Promise<ValidationResult> {
  // 1. Check operation is allowed
  const allowedOps = agentCapability.allowed_operations.map(
    (op) => op.operation_type,
  );
  if (!allowedOps.includes(receipt.operation_type)) {
    throw new Error(`Operation ${receipt.operation_type} not allowed`);
  }

  // 2. Load operation-specific schema
  const operationConfig = agentCapability.allowed_operations.find(
    (op) => op.operation_type === receipt.operation_type,
  );
  const schema = await loadSchema(operationConfig.schema_ref);

  // 3. Validate operation_details against schema
  const schemaValid = ajv.validate(schema, receipt.operation_details);

  // 4. Apply operation-specific constraints
  if (receipt.operation_type === 'swap') {
    if (
      receipt.operation_details.actual_slippage >
      operationConfig.constraints.max_slippage_percent
    ) {
      throw new Error('Slippage exceeded');
    }
  }

  return { valid: true };
}
```

### Creating Custom Capability

```typescript
const customArbitrageBot = {
  template_id: 'CUSTOM_arb_bot_v1',
  version: '1.0.0',
  description: 'Arbitrage bot with flash loan support',

  allowed_operations: [
    {
      operation_type: 'swap',
      schema_ref: 'operations/swap.schema.json',
      constraints: {
        max_slippage_percent: 0.5, // Tighter for arb
        max_route_hops: 2,
      },
    },
    {
      operation_type: 'flash_loan',
      schema_ref: 'operations/flash_loan.schema.json',
      constraints: {
        max_loan_amount_usdc: 100000000000, // 100k USDC
        min_profit_after_fees_usdc: 10000, // $0.01 min profit
      },
    },
    {
      operation_type: 'arbitrage',
      schema_ref: 'operations/arbitrage.schema.json',
      constraints: {
        max_dexes_per_tx: 3,
        min_net_profit_usdc: 10000,
      },
    },
  ],

  allowed_programs: [
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Flash loans
  ],

  oracle_source: 'pyth_mainnet',
};
```

---

## Off-Chain Verification

See [docs/off-chain-verification.md](../docs/off-chain-verification.md) for complete verification node implementation details.

**Verification Flow**:

1. Node monitors new receipts from Arweave
2. Fetches transaction data from Solana RPC
3. Loads agent's capability template
4. Applies operation-specific verification rules
5. Generates cryptographic proof if violation found
6. Submits challenge to on-chain adjudication

**Example**: Verifying swap slippage

```typescript
// Node fetches actual transaction
const tx = await connection.getTransaction(receipt.execution.tx_signatures[0]);

// Calculate actual slippage from on-chain data
const actualSlippage = calculateSlippage(
  tx.meta.preTokenBalances,
  tx.meta.postTokenBalances,
);

// Load agent's capability
const capability = await fetchCapability(receipt.agent_id);
const swapConstraints = capability.allowed_operations.find(
  (op) => op.operation_type === 'swap',
).constraints;

// Compare
if (actualSlippage > swapConstraints.max_slippage_percent) {
  const proof = generateSlippageProof(tx, actualSlippage);
  await submitChallenge(receipt.task_id, 'SWAP_003_SLIPPAGE', proof);
}
```

---

## Benefits of Modular Architecture

✅ **Granular Permissions** - Agents get exactly the operations they need, nothing more

✅ **Reusable Schemas** - One `swap.schema.json` used across all capability templates

✅ **Easy Maintenance** - Update operation schema once, all templates inherit changes

✅ **Flexible Composition** - Mix operations to create custom bots for specific strategies

✅ **Clear Verification** - Each operation has dedicated verification rules

✅ **Type Safety** - Receipt validates against specific operation schema based on discriminator

✅ **Extensibility** - Add new operations without modifying existing schemas

✅ **Custom Strategies** - Traders can create bots with unique operation combinations

---

## Migration from v1

**v1 (Monolithic):**

```json
{
  "schema_version": "1.0",
  "swap_details": { ... }  // ← Embedded in receipt
}
```

**v2 (Modular):**

```json
{
  "schema_version": "2.0",
  "operation_type": "swap",      // ← Discriminator
  "operation_details": { ... }   // ← Generic field, schema determined by operation_type
}
```

**Breaking Changes:**

- `swap_details` → `operation_details` (field rename)
- Must include `operation_type` field
- Schema version bumped to `2.x`

**Backward Compatibility:**

- v1 receipts can coexist with v2
- Validation checks `schema_version` to determine structure

---

## Next Steps

1. ✅ Generate TypeScript types from schemas
2. ✅ Implement operation-specific validators
3. ⬜ Create verification rule sets for each operation
4. ⬜ Build capability template registry (on-chain)
5. ⬜ Implement receipt validation in ReceiptService
6. ⬜ Create verification node with operation routing
7. ⬜ Add schema testing suite
8. ⬜ Deploy to Arweave for permanent storage

---

## Resources

- [JSON Schema Documentation](https://json-schema.org/)
- [Off-Chain Verification](../docs/off-chain-verification.md)
- [Technical Documentation](../docs/technical.docs.md)
- [Example Receipts](examples/composable-receipt-example.ts)
