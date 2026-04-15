import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../lib/database/base.entity';

@Entity('receipts')
@Index(['taskId'], { unique: true })
@Index(['agentId'])
export class ReceiptEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  agentId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  taskId: string;

  @Column({ type: 'varchar', length: 64 })
  outputHash: string;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cid?: string;
}
