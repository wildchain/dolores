import { TaskStatus } from '../task.entity';

// Must be classes (not interfaces) — NestJS needs runtime metadata
// when isolatedModules + emitDecoratorMetadata are enabled.

// Sent by the agent runtime when it calls complete_task() on-chain.
export class CompleteTaskDto {
    outputHash: string;    // sha256(receipt_json)
    completedAt: number;   // unix timestamp
    arweaveCid?: string;   // set if receipt already uploaded to Arweave
    attestationTx?: string;
}

// Internal — used by TaskService for any status transition.
export class UpdateTaskStatusDto {
    status: TaskStatus;
    outputHash?: string;
    completedAt?: number;
    arweaveCid?: string;
    attestationTx?: string;
}
