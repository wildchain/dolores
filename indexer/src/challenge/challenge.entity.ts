import { BaseRocksDBEntity } from '../lib/database/base-rocksdb.entity';

export enum ChallengeStatus {
  Submitted = 'submitted',
  Failed = 'failed',
}

export interface ChallengeEntity extends BaseRocksDBEntity {
  id: string; // Composite key: taskId
  taskId: string;
  agentId: string;
  reviewerId: string;
  pendingAttestationPda: string;
  violationHash: string;
  evidenceCid: string;
  challengeTx?: string;
  status: ChallengeStatus;
  // Inherited from BaseRocksDBEntity:
  // createdAt: number;
  // updatedAt: number;
}

// Key prefixes for RocksDB
export const CHALLENGE_PREFIX = 'challenge';
export const CHALLENGE_BY_AGENT_PREFIX = 'challenge:agent';
export const CHALLENGE_BY_REVIEWER_PREFIX = 'challenge:reviewer';

export function getChallengeKey(taskId: string): string {
  return `${CHALLENGE_PREFIX}:${taskId}`;
}

export function getChallengeByAgentKey(
  agentId: string,
  taskId: string,
): string {
  return `${CHALLENGE_BY_AGENT_PREFIX}:${agentId}:${taskId}`;
}

export function getChallengeByReviewerKey(
  reviewerId: string,
  taskId: string,
): string {
  return `${CHALLENGE_BY_REVIEWER_PREFIX}:${reviewerId}:${taskId}`;
}
