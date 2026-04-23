/**
 * DTO for unsigned transaction responses
 */
export interface UnsignedTransactionDto {
  transaction: string; // Base64-encoded serialized transaction
  message: string; // Human-readable description of what the transaction does
  blockhash: string; // Recent blockhash used
}

/**
 * DTO for building file-challenge transaction
 */
export interface BuildFileChallengeDto {
  taskId: string; // 32-byte task ID as hex
  agentId: string; // Agent pubkey as base58
  receiptUrl: string; // Arweave URL to receipt
}

/**
 * DTO for building auto-adjudication transaction
 */
export interface BuildAutoAdjudicateDto {
  taskId: string; // 32-byte task ID as hex
  agentId: string; // Agent pubkey as base58
  approve: boolean; // true to approve, false to reject
}
