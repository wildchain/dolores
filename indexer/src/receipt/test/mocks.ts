import { ExecutionReceipt } from '../interfaces/execution-receipt.interface';
import { ReceiptEntity } from '../receipt.entity';
import { CreateReceiptDto } from '../dto/create-receipt.dto';

/**
 * Mock execution receipt for testing
 */
export const mockExecutionReceipt: ExecutionReceipt = {
  schema_version: '1.0',
  task_id: 'task-test-123',
  agent_id: 'AgentPubkey1234567890',
  operator: 'OperatorPubkey1234567890',
  assigned_by: 'TraderPubkey1234567890',
  timestamp_unix: 1743724800,
  execution: {
    tx_signatures: [
      '5Kj8xVmN3a2bCdEfGhIjKlMnOpQrStUvWxYz1234567890',
      '9xQeWvG81a2bCdEfGhIjKlMnOpQrStUvWxYz1234567890',
    ],
    programs_called: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
    instructions_executed: ['swap', 'route_swap'],
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
    summary: 'Swapped 1 USDC for 0.00523 SOL at 191.2 USDC/SOL',
  },
};

/**
 * Mock receipt entity for testing
 */
export const mockReceiptEntity: ReceiptEntity = {
  id: 1,
  agentId: 'AgentPubkey1234567890',
  taskId: 'task-test-123',
  outputHash: 'abc123def456outputhash',
  timestamp: 1743724800,
  cid: 'arweave-tx-id-xyz123',
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-01T00:00:00Z'),
};

/**
 * Mock create receipt DTO for testing
 */
export const mockCreateReceiptDto: CreateReceiptDto = {
  agentId: 'AgentPubkey1234567890',
  taskId: 'task-test-123',
  outputHash: 'abc123def456outputhash',
  timestamp: 1743724800,
};

/**
 * Create a mock execution receipt with custom values
 */
export function createMockExecutionReceipt(
  overrides?: Partial<ExecutionReceipt>,
): ExecutionReceipt {
  return {
    ...mockExecutionReceipt,
    ...overrides,
  };
}

/**
 * Create a mock receipt entity with custom values
 */
export function createMockReceiptEntity(
  overrides?: Partial<ReceiptEntity>,
): ReceiptEntity {
  return {
    ...mockReceiptEntity,
    ...overrides,
  };
}
