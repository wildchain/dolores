export interface TrustBadge {
  totalTasks: number;
  completedTasks: number;
  successRate: number; // 0-100
  avgResponseTime: number; // in seconds
  stakeAmount: number; // in lamports
  ageSince: string; // ISO date string
}

export interface AgentListItemDto {
  agentId: string; // Pubkey as base58 string
  operator: string; // Pubkey as base58 string
  name: string;
  description: string;
  capabilities: string[]; // Array of capability names
  trustBadge: TrustBadge;
  isActive: boolean;
  stakeAmount: number; // in lamports
  reputationScore: number;
  slashCount: number;
}

export interface AgentDetailsDto extends AgentListItemDto {
  manifestUrl: string; // Arweave URL
  manifest?: any; // Full manifest JSON (optional, cached)
  registryPda: string; // Pubkey as base58 string
  fundPda: string; // Pubkey as base58 string
  registeredAt: number; // Unix timestamp
  fundCreatedAt: number; // Unix timestamp
  // Registry account fields
  capabilityHash: number[]; // 32-byte hash
  reputationScore: number;
  slashCount: number;
  arweaveCid: string;
  declaredStake: number; // in lamports
  lastAttestedAt: number; // Unix timestamp
}

export interface AgentTaskDto {
  taskId: string; // Task ID as hex
  challengeId: string; // Challenge PDA as base58
  status: "pending" | "completed" | "failed" | "disputed";
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp (optional)
  requester: string; // Pubkey as base58
  receiptUrl?: string; // Arweave URL (optional)
}
