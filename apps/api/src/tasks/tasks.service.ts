import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { SolanaService } from '../solana/solana.service';
import { RocksDBService } from '@dolores/database';
import {
  TaskListItemDto,
  TaskDetailsDto,
  TaskFilterDto,
  TaskStatus,
  BuildRegisterTaskDto,
  UnsignedTransactionDto,
} from '@dolores/shared';
import { TaskCacheEntity, TaskCacheData } from './task-cache.entity';
import bs58 from 'bs58';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private solanaService: SolanaService,
    private rocksdb: RocksDBService,
  ) {}

  /**
   * Get filtered tasks with pagination
   */
  async getTasks(filter: TaskFilterDto): Promise<TaskListItemDto[]> {
    try {
      const { limit = 20, offset = 0 } = filter;
      const safeLimit = Math.min(limit, 100);

      // Get all tasks from cache
      let tasks = await this.getAllCachedTasks();

      // Apply filters
      if (filter.agentId) {
        tasks = tasks.filter((t) => t.agentId === filter.agentId);
      }
      if (filter.requester) {
        tasks = tasks.filter((t) => t.requester === filter.requester);
      }
      if (filter.status) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
      if (filter.capabilityName) {
        tasks = tasks.filter((t) => t.capabilityName === filter.capabilityName);
      }

      // Sort by creation date (newest first)
      tasks.sort((a, b) => b.createdAt - a.createdAt);

      // Apply pagination
      const paginated = tasks.slice(offset, offset + safeLimit);

      return paginated.map((t) => this.mapToListDto(t));
    } catch (error) {
      this.logger.error('Failed to get tasks', error);
      throw error;
    }
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskId: string): Promise<TaskDetailsDto> {
    try {
      // Try cache first
      const cached = await this.findCachedTaskById(taskId);
      if (cached) {
        return this.mapToDetailsDto(cached);
      }

      // If not in cache, task doesn't exist
      throw new NotFoundException(`Task ${taskId} not found`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get task details for ${taskId}`, error);
      throw error;
    }
  }

  /**
   * Build unsigned transaction for registering a task
   */
  async buildRegisterTask(
    dto: BuildRegisterTaskDto,
    requesterWallet: string,
  ): Promise<UnsignedTransactionDto> {
    try {
      const agentPubkey = new PublicKey(dto.agentId);
      const requesterPubkey = new PublicKey(requesterWallet);
      const connection = this.solanaService.getConnection();
      const adjudicationProgram = this.solanaService.getAdjudicationProgram();

      // Convert task ID hex to Buffer
      const taskIdBuffer = Buffer.from(dto.taskId, 'hex');
      if (taskIdBuffer.length !== 32) {
        throw new Error('Task ID must be 32 bytes');
      }

      // Derive challenge PDA
      const [challengePda] = this.solanaService.deriveChallengePda(
        agentPubkey,
        taskIdBuffer,
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      // Build register_task instruction (use any to bypass type checking)
      const program: any = adjudicationProgram;
      const tx = await program.methods
        .registerTask(
          Array.from(taskIdBuffer),
          dto.capabilityName,
          dto.parametersJson,
        )
        .accounts({
          challenge: challengePda,
          agent: agentPubkey,
          requester: requesterPubkey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.recentBlockhash = blockhash;
      tx.feePayer = requesterPubkey;

      // Serialize transaction
      const serialized = tx.serialize({ requireAllSignatures: false });
      const base64Tx = serialized.toString('base64');

      const message = `Register task "${dto.capabilityName}" with agent ${dto.agentId.substring(0, 8)}...`;

      return {
        transaction: base64Tx,
        message,
        blockhash,
      };
    } catch (error) {
      this.logger.error('Failed to build register task transaction', error);
      throw error;
    }
  }

  /**
   * Cache task data
   */
  async cacheTask(data: TaskCacheData): Promise<void> {
    const entity = new TaskCacheEntity(data);
    await this.rocksdb.put(entity.getKey(), entity.toJSON());
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    agentId: string,
    taskId: string,
    status: TaskStatus,
    updates: Partial<TaskCacheData> = {},
  ): Promise<void> {
    const key = TaskCacheEntity.createKey(agentId, taskId);
    const cached = await this.rocksdb.get(key);

    if (!cached) {
      this.logger.warn(`Task ${taskId} not found in cache for update`);
      return;
    }

    const data: TaskCacheData = JSON.parse(cached);
    data.status = status;
    data.updatedAt = Date.now();

    // Apply additional updates
    Object.assign(data, updates);

    const entity = new TaskCacheEntity(data);
    await this.rocksdb.put(key, entity.toJSON());
  }

  /**
   * Get all cached tasks
   */
  private async getAllCachedTasks(): Promise<TaskCacheData[]> {
    const keys = await this.rocksdb.keys('task:');
    const tasks: TaskCacheData[] = [];

    for (const key of keys) {
      const data = await this.rocksdb.get(key);
      if (data) {
        tasks.push(JSON.parse(data));
      }
    }

    return tasks;
  }

  /**
   * Find cached task by ID (search across all agents)
   */
  private async findCachedTaskById(
    taskId: string,
  ): Promise<TaskCacheData | null> {
    const allTasks = await this.getAllCachedTasks();
    return allTasks.find((t) => t.taskId === taskId) || null;
  }

  /**
   * Map to list DTO
   */
  private mapToListDto(data: TaskCacheData): TaskListItemDto {
    return {
      taskId: data.taskId,
      agentId: data.agentId,
      agentName: data.agentName,
      requester: data.requester,
      status: data.status as TaskStatus,
      capabilityName: data.capabilityName,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      hasReceipt: !!data.receiptUrl,
      stakeAmount: data.stakeAmount,
    };
  }

  /**
   * Map to details DTO
   */
  private mapToDetailsDto(data: TaskCacheData): TaskDetailsDto {
    const listDto = this.mapToListDto(data);

    return {
      ...listDto,
      challengePda: data.challengePda,
      parametersJson: data.parametersJson,
      receiptUrl: data.receiptUrl,
      receipt: data.receipt,
      disputeReason: data.disputeReason,
      adjudicatedBy: data.adjudicatedBy,
      adjudicatedAt: data.adjudicatedAt,
    };
  }
}
