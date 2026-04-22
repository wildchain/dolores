import { BaseRocksDBEntity } from '../lib/database/base-rocksdb.entity';
import {
  ReceiptStatus,
  ReceiptEntity as SharedReceiptEntity,
} from '@dolores/shared';

// Re-export ReceiptStatus from shared package
export { ReceiptStatus };

// Extend shared entity with RocksDB base
export interface ReceiptEntity
  extends
    BaseRocksDBEntity,
    Omit<SharedReceiptEntity, 'id' | 'createdAt' | 'updatedAt'> {
  id: string; // taskId is the primary key
}

// Key prefixes for RocksDB
export const RECEIPT_PREFIX = 'receipt';
export const RECEIPT_BY_AGENT_PREFIX = 'receipt:agent';
export const RECEIPT_BY_STATUS_PREFIX = 'receipt:status';

// Helper to generate RocksDB keys
export function getReceiptKey(taskId: string): string {
  return `${RECEIPT_PREFIX}:${taskId}`;
}

export function getReceiptByAgentKey(agentId: string, taskId: string): string {
  return `${RECEIPT_BY_AGENT_PREFIX}:${agentId}:${taskId}`;
}

export function getReceiptByStatusKey(
  status: ReceiptStatus,
  taskId: string,
): string {
  return `${RECEIPT_BY_STATUS_PREFIX}:${status}:${taskId}`;
}
