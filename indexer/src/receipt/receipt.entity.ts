import { Entity } from 'typeorm';
import { BaseEntity } from '../lib/database/base.entity';

@Entity('receipts')
export class ReceiptEntity extends BaseEntity {
  agentId: string;
  taskId: string;
  outputHash: string;
  timestamp: number;
  cid?: string;
}
