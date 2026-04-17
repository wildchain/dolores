import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../lib/database/base.entity';

@Entity('receipts')
export class ReceiptEntity extends BaseEntity {
  @Column({ name: 'agent_id' })
  agentId: string;

  @Column({ name: 'task_id', unique: true })
  taskId: string;

  @Column({ name: 'output_hash' })
  outputHash: string;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ nullable: true, name: 'cid' })
  cid?: string;

  // Whether submit_attestation has been sent on-chain for this receipt
  @Column({ name: 'attested', default: false })
  attested: boolean;

  // The on-chain tx signature from submit_attestation
  @Column({ name: 'attestation_tx', nullable: true })
  attestationTx?: string;

  // Score that was submitted on-chain (0–100)
  @Column({ name: 'attestation_score', nullable: true })
  attestationScore?: number;
}