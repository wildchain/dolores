export type CapabilityTemplate =
  | "DEX_TRADER_V1"
  | "LP_MANAGER_V1"
  | "YIELD_OPTIMIZER_V1"
  | "ORACLE_READER_V1"
  | "TOKEN_TRANSFER_V1"
  | "PORTFOLIO_MGMT_V1";

export type TaskStatus =
  | "pending"
  | "executing"
  | "completed"
  | "challenged"
  | "slashed";

export interface Agent {
  // Shared API shape (`AgentListItemDto`)
  agentId?: string; // Pubkey as base58 string
  operator: string; // Pubkey as base58 string
  name: string;
  description?: string;
  capabilities?: CapabilityTemplate[]; // Array of capability names
  trustBadge?: {
    totalTasks: number;
    completedTasks: number;
    successRate: number; // 0-100
    avgResponseTime: number; // in seconds
    stakeAmount: number; // in lamports
    ageSince: string; // ISO date string
  };

  isActive?: boolean;
  stakeAmount?: number; // in lamports

  // Legacy mock/preview shape still used in parts of UI
  id?: string;
  address?: string;
  capability?: CapabilityTemplate[];
  capabilityHash?: string;
  reputationScore?: number;
  slashCount?: number;
  totalTasks?: number;
  successRate?: number;
  totalStake?: number;
  validatorStake?: number;
  communityStake?: number;
  stakerCount?: number;
  arweaveCid?: string;
  registeredAt?: string;
  featured?: boolean;
}

export interface Task {
  id: string;
  agentId: string;
  agentName: string;
  assignedBy: string;
  description: string;
  status: TaskStatus;
  deadline: string;
  completedAt?: string;
  outputHash?: string;
  arweaveCid?: string;
  txSignatures: string[];
  timestamp: string;
}

export interface StakerPosition {
  agentId: string;
  agentName: string;
  agentRep: number;
  agentType: CapabilityTemplate;
  amountStaked: number;
  poolShare: number;
  claimableRewards: number;
  totalEarned: number;
  slashCount: number;
}

export interface RepPoint {
  date: string;
  score: number;
}
