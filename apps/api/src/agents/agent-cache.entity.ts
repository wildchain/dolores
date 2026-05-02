import { BaseRocksDBEntity } from '@dolores/database';

export interface AgentCacheData extends BaseRocksDBEntity {
  agentId: string; // Agent pubkey as base58
  operator: string; // Operator pubkey as base58
  name: string;
  description: string;
  capabilities: string[];
  manifestUrl: string;
  manifest?: any; // Cached manifest JSON
  registryPda: string;
  fundPda: string;
  registeredAt: number;
  fundCreatedAt: number;
  isActive: boolean;
  stakeAmount: number;
  // Registry account fields
  capabilityHash: number[]; // 32-byte hash
  reputationScore: number;
  slashCount: number;
  arweaveCid: string;
  declaredStake: number;
  lastAttestedAt: number;
  availableForHire: boolean;
  hireFeeSOL: number;
  totalEarnedSOL: number;
  communityStake: number;
  // lamports staked by community
  // Trust metrics
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  disputedTasks: number;
  totalResponseTime: number; // Sum of all response times for avg calculation
}

export class AgentCacheEntity {
  constructor(public readonly data: AgentCacheData) { }

  static createKey(agentId: string): string {
    return `agent:${agentId}`;
  }

  getKey(): string {
    return AgentCacheEntity.createKey(this.data.agentId);
  }

  toJSON(): string {
    return JSON.stringify(this.data);
  }

  // Helper methods
  getSuccessRate(): number {
    if (this.data.totalTasks === 0) return 0;
    return (this.data.completedTasks / this.data.totalTasks) * 100;
  }

  getAvgResponseTime(): number {
    if (this.data.completedTasks === 0) return 0;
    return this.data.totalResponseTime / this.data.completedTasks;
  }

  incrementTask(
    status: 'completed' | 'failed' | 'disputed',
    responseTime?: number,
  ) {
    this.data.totalTasks++;
    if (status === 'completed') {
      this.data.completedTasks++;
      if (responseTime) {
        this.data.totalResponseTime += responseTime;
      }
    } else if (status === 'failed') {
      this.data.failedTasks++;
    } else if (status === 'disputed') {
      this.data.disputedTasks++;
    }
    this.data.updatedAt = Date.now();
  }
}
