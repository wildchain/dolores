/**
 * DTO for creating a new receipt
 * Used by agents to submit task execution receipts
 */
export interface CreateReceiptDto {
  agentId: string;
  taskId: string;
  outputHash: string;
  timestamp: number;
  agentSignature: string;
}

/**
 * Response returned after uploading a receipt
 */
export interface UploadReceiptResponse {
  cid: string;
  taskId: string;
  agentId: string;
  submissionTx: string | null;
  pendingAttestationPda: string | null;
}
