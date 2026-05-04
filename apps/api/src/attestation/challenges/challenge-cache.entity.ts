import { BaseRocksDBEntity } from '@dolores/database';

export interface ChallengeCacheData extends BaseRocksDBEntity {
  challengePda: string; // Challenge PDA as base58
  taskId: string; // Task ID as hex
  agentId: string; // Agent pubkey as base58
  requester: string; // Requester pubkey as base58
  status: 'pending' | 'completed' | 'failed' | 'disputed';
  capabilityName: string;
  parametersJson: string;
  receiptUrl?: string; // Arweave URL
  receipt?: any; // Cached receipt JSON
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp
  disputeReason?: string;
  adjudicatedBy?: string; // Adjudicator pubkey
  adjudicatedAt?: number; // Unix timestamp
}

export class ChallengeCacheEntity {
  constructor(public readonly data: ChallengeCacheData) {}

  static createKey(challengePda: string): string {
    return `challenge:${challengePda}`;
  }

  getKey(): string {
    return ChallengeCacheEntity.createKey(this.data.challengePda);
  }

  toJSON(): string {
    return JSON.stringify(this.data);
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

  isPending(): boolean {
    return this.data.status === 'pending';
  }
}
