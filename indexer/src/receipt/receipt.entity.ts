import { BaseRocksDBEntity } from '../lib/database/base-rocksdb.entity';

export enum ReceiptStatus {
  Received = 'received',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Slashed = 'slashed',
  SubmissionFailed = 'submission_failed',
}

export interface ReceiptEntity extends BaseRocksDBEntity {
  id: string; // taskId is the primary key
  agentId: string;
  taskId: string;
  outputHash: string;
  timestamp: number;
  cid?: string;
  status: ReceiptStatus;
  pendingAttestationPda?: string;
  submissionTx?: string;
  approvalTx?: string;
  challengeTx?: string;
  reviewerId?: string;
  verificationOutcome?: Record<string, unknown>;
  // Inherited from BaseRocksDBEntity:
  // createdAt: number;
  // updatedAt: number;
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
