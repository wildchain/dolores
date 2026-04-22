// Posted by the agent runtime (dolores-agent) after reading
// the TaskRegistered event from the indexer or Solana websocket.
// Must be a class (not interface) — NestJS needs runtime metadata
// when isolatedModules + emitDecoratorMetadata are enabled.

export class CreateTaskDto {
    taskId: string;           // hex string of [u8;32]
    agentId: string;          // agent pubkey
    assignedBy: string;       // user/operator pubkey
    instruction: string;      // goal text from on-chain TaskRecord
    deadline: number;         // unix timestamp
    onChainCreatedAt: number; // unix timestamp from TaskRegistered event
}