import { BaseRocksDBEntity } from '@dolores/database';
import {
  ChallengeStatus,
  ChallengeEntity as SharedChallengeEntity,
} from '@dolores/shared';

// Re-export ChallengeStatus from shared package
export { ChallengeStatus };

// Extend shared entity with RocksDB base
export interface ChallengeEntity
  extends
    BaseRocksDBEntity,
    Omit<SharedChallengeEntity, 'id' | 'createdAt' | 'updatedAt'> {
  id: string; // Composite key: taskId
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
