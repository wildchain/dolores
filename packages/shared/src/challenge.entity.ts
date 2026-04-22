import { BaseEntity } from "./receipt.entity";

/**
 * Challenge status enum
 */
export enum ChallengeStatus {
  Submitted = "submitted",
  Failed = "failed",
}

/**
 * Challenge entity interface
 */
export interface ChallengeEntity extends BaseEntity {
  taskId: string;
  agentId: string;
  reviewerId: string;
  pendingAttestationPda: string;
  violationHash: string;
  evidenceCid: string;
  challengeTx?: string;
  status: ChallengeStatus;
  verificationOutcome?: Record<string, unknown>;
}
