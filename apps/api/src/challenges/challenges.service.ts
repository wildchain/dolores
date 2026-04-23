import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { SolanaService } from '../solana/solana.service';
import { RocksDBService } from '@dolores/database';
import {
  BuildFileChallengeDto,
  BuildAutoAdjudicateDto,
  UnsignedTransactionDto,
} from '@dolores/shared';
import {
  ChallengeCacheEntity,
  ChallengeCacheData,
} from './challenge-cache.entity';
import axios from 'axios';

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private solanaService: SolanaService,
    private rocksdb: RocksDBService,
  ) {}

  /**
   * Get challenge details
   */
  async getChallengeDetails(challengeId: string): Promise<ChallengeCacheData> {
    try {
      const cached = await this.getCachedChallenge(challengeId);
      if (!cached) {
        throw new NotFoundException(`Challenge ${challengeId} not found`);
      }
      return cached;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to get challenge details for ${challengeId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Build unsigned transaction for filing a challenge receipt
   */
  async buildFileChallenge(
    dto: BuildFileChallengeDto,
    operatorWallet: string,
  ): Promise<UnsignedTransactionDto> {
    try {
      const agentPubkey = new PublicKey(dto.agentId);
      const operatorPubkey = new PublicKey(operatorWallet);
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

      // Extract Arweave CID from URL
      const receiptCid = dto.receiptUrl.replace('https://arweave.net/', '');

      // Build file_challenge instruction (use any to bypass type checking)
      const program: any = adjudicationProgram;
      const tx = await program.methods
        .fileChallenge(receiptCid)
        .accounts({
          challenge: challengePda,
          agent: agentPubkey,
          operator: operatorPubkey,
        })
        .transaction();

      tx.recentBlockhash = blockhash;
      tx.feePayer = operatorPubkey;

      // Serialize transaction
      const serialized = tx.serialize({ requireAllSignatures: false });
      const base64Tx = serialized.toString('base64');

      const message = `Submit receipt for task ${dto.taskId.substring(0, 16)}...`;

      return {
        transaction: base64Tx,
        message,
        blockhash,
      };
    } catch (error) {
      this.logger.error('Failed to build file challenge transaction', error);
      throw error;
    }
  }

  /**
   * Build unsigned transaction for auto-adjudication
   */
  async buildAutoAdjudicate(
    dto: BuildAutoAdjudicateDto,
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

      // Build auto_adjudicate instruction (use any to bypass type checking)
      const program: any = adjudicationProgram;
      const tx = await program.methods
        .autoAdjudicate(dto.approve)
        .accounts({
          challenge: challengePda,
          agent: agentPubkey,
          requester: requesterPubkey,
        })
        .transaction();

      tx.recentBlockhash = blockhash;
      tx.feePayer = requesterPubkey;

      // Serialize transaction
      const serialized = tx.serialize({ requireAllSignatures: false });
      const base64Tx = serialized.toString('base64');

      const action = dto.approve ? 'Approve' : 'Reject';
      const message = `${action} task ${dto.taskId.substring(0, 16)}...`;

      return {
        transaction: base64Tx,
        message,
        blockhash,
      };
    } catch (error) {
      this.logger.error('Failed to build auto-adjudicate transaction', error);
      throw error;
    }
  }

  /**
   * Cache challenge data
   */
  async cacheChallenge(data: ChallengeCacheData): Promise<void> {
    const entity = new ChallengeCacheEntity(data);
    await this.rocksdb.put(entity.getKey(), entity.toJSON());
  }

  /**
   * Update challenge data
   */
  async updateChallenge(
    challengePda: string,
    updates: Partial<ChallengeCacheData>,
  ): Promise<void> {
    const key = ChallengeCacheEntity.createKey(challengePda);
    const cached = await this.rocksdb.get(key);

    if (!cached) {
      this.logger.warn(
        `Challenge ${challengePda} not found in cache for update`,
      );
      return;
    }

    const data: ChallengeCacheData = JSON.parse(cached);
    Object.assign(data, updates);
    data.updatedAt = Date.now();

    const entity = new ChallengeCacheEntity(data);
    await this.rocksdb.put(key, entity.toJSON());
  }

  /**
   * Get cached challenge
   */
  private async getCachedChallenge(
    challengePda: string,
  ): Promise<ChallengeCacheData | null> {
    const key = ChallengeCacheEntity.createKey(challengePda);
    const cached = await this.rocksdb.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Fetch receipt from Arweave
   */
  async fetchReceipt(receiptUrl: string): Promise<any> {
    try {
      const response = await axios.get(receiptUrl, { timeout: 5000 });
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch receipt from ${receiptUrl}`);
      return null;
    }
  }
}
