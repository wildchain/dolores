/**
 * Example: Composable Receipt Structure (v2 Schema)
 *
 * Demonstrates how operation_type discriminator works with modular operation schemas
 */

import { ExecutionReceiptV2 } from './types';

/**
 * Example 1: Swap Receipt
 */
export const swapReceipt: ExecutionReceiptV2 = {
  schema_version: '2.0',
  task_id: 'swap_task_001',
  agent_id: 'AgentPubkey123',
  operator: 'OperatorPubkey123',
  assigned_by: 'TraderPubkey123',
  timestamp_unix: 1743724800,
  operation_type: 'swap', // ← Discriminator field

  execution: {
    tx_signatures: ['5Kj8xVmN3a2bCdEfGhIjKlMnOpQrStUvWxYz1234567890'],
    programs_called: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
    instructions_executed: ['swap'],
    token_transfers: [
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000,
        direction: 'out',
      },
      {
        mint: 'So11111111111111111111111111111111111111112',
        amount: 5230000,
        direction: 'in',
      },
    ],
  },

  result: {
    status: 'success',
    summary: 'Swapped 1 USDC for 0.00523 SOL',
  },

  // Validated against operations/swap.schema.json
  operation_details: {
    dex_protocol: 'jupiter',
    input_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    output_token: 'So11111111111111111111111111111111111111112',
    input_amount: 1000000,
    output_amount: 5230000,
    expected_output: 5240000,
    slippage_tolerance: 1.0,
    actual_slippage: 0.19,
    price_impact: 0.08,
    route_hops: 1,
    effective_price: 191.2,
  },
};

/**
 * Example 2: Limit Order Receipt
 */
export const limitOrderReceipt: ExecutionReceiptV2 = {
  schema_version: '2.0',
  task_id: 'limit_order_task_002',
  agent_id: 'AgentPubkey123',
  operator: 'OperatorPubkey123',
  assigned_by: 'TraderPubkey123',
  timestamp_unix: 1743724850,
  operation_type: 'limit_order', // ← Different operation type

  execution: {
    tx_signatures: ['7Lm9pYoQ4r3tBvFnGkJhMnPqRsTuVxZy2345678901'],
    programs_called: ['PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY'],
    instructions_executed: ['place_limit_order'],
    token_transfers: [], // Order placed, not filled yet
  },

  result: {
    status: 'success',
    summary: 'Placed buy order for 10 SOL at 180 USDC',
  },

  // Validated against operations/limit_order.schema.json
  operation_details: {
    order_book_program: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    order_book_address: '4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ959V',
    base_token: 'So11111111111111111111111111111111111111112',
    quote_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    side: 'buy',
    limit_price: 180.0,
    size: 10000000000, // 10 SOL in lamports
    expiry_timestamp: 1744329600, // 7 days
    order_id: 'order_12345',
    fee_tier: 'maker',
    post_only: true,
  },
};

/**
 * Example 3: Add Liquidity Receipt
 */
export const addLiquidityReceipt: ExecutionReceiptV2 = {
  schema_version: '2.0',
  task_id: 'add_liq_task_003',
  agent_id: 'AgentPubkey456',
  operator: 'OperatorPubkey456',
  assigned_by: 'TraderPubkey456',
  timestamp_unix: 1743724900,
  operation_type: 'add_liquidity',

  execution: {
    tx_signatures: ['8Np0qZrR5s4uCwGoHlKoNqStTvYz3456789012'],
    programs_called: ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],
    instructions_executed: ['deposit'],
    token_transfers: [
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000000, // 1000 USDC out
        direction: 'out',
      },
      {
        mint: 'So11111111111111111111111111111111111111112',
        amount: 5230000000, // 5.23 SOL out
        direction: 'out',
      },
      {
        mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
        amount: 72340000, // LP tokens in
        direction: 'in',
      },
    ],
  },

  result: {
    status: 'success',
    summary: 'Added 1000 USDC + 5.23 SOL to USDC/SOL pool',
  },

  // Validated against operations/add_liquidity.schema.json
  operation_details: {
    pool_program: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    pool_address: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ',
    token_a_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    token_b_mint: 'So11111111111111111111111111111111111111112',
    token_a_amount: 1000000000,
    token_b_amount: 5230000000,
    lp_token_mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    lp_tokens_received: 72340000,
    min_lp_tokens: 72000000,
    pool_token_ratio: 191.2,
    price_impact: 0.05,
  },
};

/**
 * Example 4: Borrow Receipt
 */
export const borrowReceipt: ExecutionReceiptV2 = {
  schema_version: '2.0',
  task_id: 'borrow_task_004',
  agent_id: 'AgentPubkey789',
  operator: 'OperatorPubkey789',
  assigned_by: 'TraderPubkey789',
  timestamp_unix: 1743724950,
  operation_type: 'borrow',

  execution: {
    tx_signatures: ['9Oq1rAsS6t5vDxHpImLpOrTuVz4567890123'],
    programs_called: ['So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'],
    instructions_executed: ['borrow'],
    token_transfers: [
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 5000000000, // 5000 USDC borrowed
        direction: 'in',
      },
    ],
  },

  result: {
    status: 'success',
    summary: 'Borrowed 5000 USDC against 10 SOL collateral',
  },

  // Validated against operations/borrow.schema.json
  operation_details: {
    lending_program: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    lending_pool: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    position_address: 'PositionPubkey123456789',
    collateral_mint: 'So11111111111111111111111111111111111111112',
    collateral_amount: 10000000000, // 10 SOL
    borrow_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    borrow_amount: 5000000000, // 5000 USDC
    collateral_ratio: 191.2, // ~191% collateralization
    interest_rate: 8.5,
    liquidation_threshold: 125,
    health_factor: 1.53,
  },
};

/**
 * Example 5: Flash Loan + Arbitrage Receipt
 */
export const flashLoanArbitrageReceipt: ExecutionReceiptV2 = {
  schema_version: '2.0',
  task_id: 'flash_arb_task_005',
  agent_id: 'AgentPubkey999',
  operator: 'OperatorPubkey999',
  assigned_by: 'TraderPubkey999',
  timestamp_unix: 1743725000,
  operation_type: 'arbitrage',

  execution: {
    tx_signatures: ['1Pr2sCtT7u6wEyIqJnMqPsSvWz5678901234'],
    programs_called: [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Flash loan
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca
    ],
    instructions_executed: ['flash_loan', 'swap', 'swap', 'repay_flash_loan'],
    token_transfers: [
      // Net result: profit only
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 234500, // 0.2345 USDC profit
        direction: 'in',
      },
    ],
  },

  result: {
    status: 'success',
    summary: 'Arbitrage: Borrowed 10K USDC, netted $0.23 profit after fees',
  },

  // Validated against operations/arbitrage.schema.json
  operation_details: {
    dex_programs: [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    ],
    trades: [
      {
        dex: 'jupiter',
        input_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        output_token: 'So11111111111111111111111111111111111111112',
        input_amount: 10000000000,
        output_amount: 52300000000,
      },
      {
        dex: 'orca',
        input_token: 'So11111111111111111111111111111111111111112',
        output_token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        input_amount: 52300000000,
        output_amount: 10000234500,
      },
    ],
    net_profit_usdc: 0.2345,
    gas_fee_usdc: 0.0005,
    profit_percentage: 0.00234,
    route: 'USDC -> SOL (Jupiter) -> USDC (Orca)',
  },
};

/**
 * Validation Helper: Route to correct operation schema
 */
export function getOperationSchema(operationType: string): string {
  const schemaMap: Record<string, string> = {
    swap: 'operations/swap.schema.json',
    limit_order: 'operations/limit_order.schema.json',
    add_liquidity: 'operations/add_liquidity.schema.json',
    remove_liquidity: 'operations/remove_liquidity.schema.json',
    stake: 'operations/stake.schema.json',
    borrow: 'operations/borrow.schema.json',
    transfer: 'operations/transfer.schema.json',
    flash_loan: 'operations/flash_loan.schema.json',
    arbitrage: 'operations/arbitrage.schema.json',
    liquidate: 'operations/liquidate.schema.json',
  };

  return schemaMap[operationType] || 'base/execution-receipt.v2.schema.json';
}

/**
 * Capability Template Usage Example
 */
export const agentCapabilityExample = {
  agent_id: 'AgentPubkey123',
  capability_template: 'DEX_TRADER_V2',

  // This agent can ONLY perform operations listed in DEX_TRADER_V2
  allowed_operation_types: ['swap', 'limit_order'],

  // Each operation has specific constraints from the template
  operation_constraints: {
    swap: {
      max_slippage_percent: 2.0,
      max_route_hops: 3,
      max_price_impact_percent: 1.0,
    },
    limit_order: {
      max_order_spread_percent: 5.0,
      max_order_duration_seconds: 2592000, // 30 days
    },
  },
};

/**
 * Custom Capability Example
 */
export const customArbitrageBot = {
  agent_id: 'AgentPubkey999',
  capability_template: 'CUSTOM_arbitrage_bot_001',

  // Custom combination of operations
  allowed_operation_types: ['swap', 'flash_loan', 'arbitrage'],

  allowed_programs: [
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ],

  operation_constraints: {
    swap: {
      max_slippage_percent: 0.5, // Tighter for arb
      max_route_hops: 2,
    },
    flash_loan: {
      max_loan_amount_usdc: 100000000000, // 100k USDC
      min_profit_after_fees_usdc: 10000, // Must profit at least $0.01
    },
    arbitrage: {
      max_dexes_per_tx: 3,
      min_net_profit_usdc: 10000,
    },
  },
};
