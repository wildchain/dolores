export enum TaskStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  DISPUTED = "disputed",
}

export interface BuildRegisterTaskDto {
  agentId: string; // Agent pubkey as base58
  taskId: string; // 32-byte task ID as hex
  capabilityName: string; // Name of the capability to execute
  parametersJson: string; // JSON string of task parameters
  stakeAmount?: number; // Optional override stake amount
  timeoutSeconds?: number; // Optional timeout
}

export interface TaskListItemDto {
  taskId: string; // Task ID as hex
  agentId: string; // Agent pubkey as base58
  agentName: string; // From registry
  requester: string; // Requester pubkey as base58
  status: TaskStatus;
  capabilityName: string;
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp (optional)
  hasReceipt: boolean;
  stakeAmount: number; // in lamports
}

export interface TaskDetailsDto extends TaskListItemDto {
  challengePda: string; // Challenge PDA as base58
  parametersJson: string; // Full parameters JSON string
  receiptUrl?: string; // Arweave URL (optional)
  receipt?: any; // Parsed receipt JSON (optional, cached)
  disputeReason?: string; // If status is disputed
  adjudicatedBy?: string; // Adjudicator pubkey (optional)
  adjudicatedAt?: number; // Unix timestamp (optional)
}

export interface TaskFilterDto {
  agentId?: string; // Filter by agent
  requester?: string; // Filter by requester
  status?: TaskStatus; // Filter by status
  capabilityName?: string; // Filter by capability
  limit?: number; // Pagination limit (default 20, max 100)
  offset?: number; // Pagination offset (default 0)
}
