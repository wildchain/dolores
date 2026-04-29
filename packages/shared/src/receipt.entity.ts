/**
 * Receipt status enum
 */
export enum ReceiptStatus {
  Received = "received",
  PendingReview = "pending_review",
  Approved = "approved",
  Slashed = "slashed",
  SubmissionFailed = "submission_failed",
}

/**
 * Base entity interface for timestamped entities
 */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Receipt entity interface
 */
export interface ReceiptEntity extends BaseEntity {
  agentId: string;
  taskId: string;
  outputHash: string;
  agentSignature?: string;
  timestamp: number;
  cid?: string;
  status: ReceiptStatus;
  pendingAttestationPda?: string;
  submissionTx?: string;
  approvalTx?: string;
  challengeTx?: string;
  reviewerId?: string;
  verificationOutcome?: Record<string, unknown>;
}
