import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../lib/database/base.entity';

export enum TaskStatus {
    Pending = 'pending',
    Completed = 'completed',
    Challenged = 'challenged',
    Slashed = 'slashed',
    Dismissed = 'dismissed',
}

@Entity('tasks')
export class TaskEntity extends BaseEntity {


    @Column({ name: 'task_id', unique: true })
    taskId: string; // hex string of [u8;32]

    @Column({ name: 'agent_id' })
    agentId: string; // agent pubkey

    @Column({ name: 'assigned_by' })
    assignedBy: string; // user/operator pubkey who called register_task()



    @Column({ name: 'instruction', length: 256 })
    instruction: string; // natural-language goal e.g. "transfer 0.001 SOL to <pubkey>"



    @Column({ name: 'output_hash', nullable: true })
    outputHash?: string; // sha256(receipt_json) — set by complete_task()

    @Column({ name: 'status', type: 'varchar', default: TaskStatus.Pending })
    status: TaskStatus;

    @Column({ name: 'deadline', type: 'bigint' })
    deadline: number; // unix timestamp

    @Column({ name: 'on_chain_created_at', type: 'bigint' })
    onChainCreatedAt: number; // unix timestamp from TaskRegistered event

    @Column({ name: 'completed_at', type: 'bigint', nullable: true })
    completedAt?: number; // unix timestamp from TaskCompleted event



    @Column({ name: 'arweave_cid', nullable: true })
    arweaveCid?: string; // set after receipt uploaded to Arweave

    @Column({ name: 'attestation_tx', nullable: true })
    attestationTx?: string; // on-chain tx from submit_attestation()
}