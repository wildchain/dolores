import { Injectable, Logger } from '@nestjs/common';
import { RocksDBService } from '@dolores/lib/database';
import {
  ReceiptEntity,
  ReceiptStatus,
  getReceiptKey,
  getReceiptByAgentKey,
  getReceiptByStatusKey,
  RECEIPT_BY_AGENT_PREFIX,
  RECEIPT_BY_STATUS_PREFIX,
} from './receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import {
  createEntity,
  updateEntity,
} from '@dolores/lib/database/base-rocksdb.entity';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(private readonly db: RocksDBService) {}

  async create(dto: CreateReceiptDto): Promise<ReceiptEntity> {
    const receipt = createEntity<ReceiptEntity>(dto.taskId, {
      agentId: dto.agentId,
      taskId: dto.taskId,
      outputHash: dto.outputHash,
      timestamp: dto.timestamp,
      status: ReceiptStatus.Received,
    });

    // Store in multiple indexes for efficient queries
    await this.db.batch([
      { type: 'put', key: getReceiptKey(receipt.taskId), value: receipt },
      {
        type: 'put',
        key: getReceiptByAgentKey(receipt.agentId, receipt.taskId),
        value: receipt,
      },
      {
        type: 'put',
        key: getReceiptByStatusKey(receipt.status, receipt.taskId),
        value: receipt,
      },
    ]);

    return receipt;
  }

  async findByTaskId(taskId: string): Promise<ReceiptEntity | null> {
    return this.db.get<ReceiptEntity>(getReceiptKey(taskId));
  }

  async findByAgentId(agentId: string): Promise<ReceiptEntity[]> {
    const prefix = `${RECEIPT_BY_AGENT_PREFIX}:${agentId}`;
    const results = await this.db.scan<ReceiptEntity>({ prefix });
    // Sort by createdAt descending
    return results
      .map((r) => r.value)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateCid(taskId: string, cid: string): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;

    const updated = updateEntity(receipt, { cid });
    await this.updateReceipt(receipt, updated);
    return updated;
  }

  async markPendingReview(
    taskId: string,
    pendingAttestationPda: string,
    submissionTx: string,
  ): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;

    const updated = updateEntity(receipt, {
      status: ReceiptStatus.PendingReview,
      pendingAttestationPda,
      submissionTx,
    });

    await this.updateReceipt(receipt, updated);
    return updated;
  }

  async markApproved(
    taskId: string,
    approvalTx: string,
    reviewerId: string,
    verificationOutcome?: Record<string, unknown>,
  ): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;

    const updated = updateEntity(receipt, {
      status: ReceiptStatus.Approved,
      approvalTx,
      reviewerId,
      verificationOutcome: verificationOutcome ?? receipt.verificationOutcome,
    });

    await this.updateReceipt(receipt, updated);
    return updated;
  }

  async markSlashed(
    taskId: string,
    challengeTx: string,
    reviewerId: string,
    verificationOutcome?: Record<string, unknown>,
  ): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;

    const updated = updateEntity(receipt, {
      status: ReceiptStatus.Slashed,
      challengeTx,
      reviewerId,
      verificationOutcome: verificationOutcome ?? receipt.verificationOutcome,
    });

    await this.updateReceipt(receipt, updated);
    return updated;
  }

  async markSubmissionFailed(taskId: string): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;

    const updated = updateEntity(receipt, {
      status: ReceiptStatus.SubmissionFailed,
    });

    await this.updateReceipt(receipt, updated);
    return updated;
  }

  async findPendingSubmission(): Promise<ReceiptEntity[]> {
    const received = await this.db.scan<ReceiptEntity>({
      prefix: getReceiptByStatusKey(ReceiptStatus.Received, '').slice(0, -1),
      limit: 5,
    });
    const failed = await this.db.scan<ReceiptEntity>({
      prefix: getReceiptByStatusKey(ReceiptStatus.SubmissionFailed, '').slice(
        0,
        -1,
      ),
      limit: 5,
    });

    return [...received, ...failed]
      .map((r) => r.value)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10);
  }

  async findPendingReview(): Promise<ReceiptEntity[]> {
    const results = await this.db.scan<ReceiptEntity>({
      prefix: getReceiptByStatusKey(ReceiptStatus.PendingReview, '').slice(
        0,
        -1,
      ),
      limit: 10,
    });

    return results
      .map((r) => r.value)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async verifyCid(taskId: string, expectedHash: string): Promise<boolean> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return false;
    return receipt.outputHash === expectedHash;
  }

  // Helper to update receipt in all indexes
  private async updateReceipt(
    oldReceipt: ReceiptEntity,
    newReceipt: ReceiptEntity,
  ): Promise<void> {
    const operations: Array<{ type: 'put' | 'del'; key: string; value?: any }> =
      [
        {
          type: 'put',
          key: getReceiptKey(newReceipt.taskId),
          value: newReceipt,
        },
        {
          type: 'put',
          key: getReceiptByAgentKey(newReceipt.agentId, newReceipt.taskId),
          value: newReceipt,
        },
      ];

    // If status changed, update status indexes
    if (oldReceipt.status !== newReceipt.status) {
      operations.push(
        {
          type: 'del',
          key: getReceiptByStatusKey(oldReceipt.status, oldReceipt.taskId),
        },
        {
          type: 'put',
          key: getReceiptByStatusKey(newReceipt.status, newReceipt.taskId),
          value: newReceipt,
        },
      );
    } else {
      operations.push({
        type: 'put',
        key: getReceiptByStatusKey(newReceipt.status, newReceipt.taskId),
        value: newReceipt,
      });
    }

    await this.db.batch(operations);
  }
}
