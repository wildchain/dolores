import { BaseRocksDBEntity } from '@dolores/database';

export interface TaskCacheData extends BaseRocksDBEntity {
  taskId: string; // Task ID as hex
  challengePda: string; // Challenge PDA as base58
  agentId: string; // Agent pubkey as base58
  agentName: string; // Cached from agent
  requester: string; // Requester pubkey as base58
  status: 'pending' | 'completed' | 'failed' | 'disputed';
  capabilityName: string;
  parametersJson: string;
  stakeAmount: number;
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp
  receiptUrl?: string; // Arweave URL
  receipt?: any; // Cached receipt JSON
  disputeReason?: string;
  adjudicatedBy?: string; // Adjudicator pubkey
  adjudicatedAt?: number; // Unix timestamp
}

export class TaskCacheEntity {
  constructor(public readonly data: TaskCacheData) {}

  static createKey(agentId: string, taskId: string): string {
    return `task:${agentId}:${taskId}`;
  }

  getKey(): string {
    return TaskCacheEntity.createKey(this.data.agentId, this.data.taskId);
  }

  toJSON(): string {
    return JSON.stringify(this.data);
  }

  // Helper methods
  getResponseTime(): number | null {
    if (!this.data.completedAt) return null;
    return this.data.completedAt - this.data.createdAt;
  }

  isCompleted(): boolean {
    return this.data.status === 'completed';
  }

  isFailed(): boolean {
    return this.data.status === 'failed';
  }

  isDisputed(): boolean {
    return this.data.status === 'disputed';
  }
}
