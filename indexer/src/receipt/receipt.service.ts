import { Injectable } from '@nestjs/common';
import { ReceiptEntity } from './receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
  ) {}

  async create(dto: CreateReceiptDto): Promise<ReceiptEntity> {
    const receipt = new ReceiptEntity(
      dto.agentId,
      dto.taskId,
      dto.outputHash,
      dto.timestamp,
    );
    receipt.id = this.idCounter++;

    this.receipts.set(dto.taskId, receipt);

    if (!this.receiptsByAgent.has(dto.agentId)) {
      this.receiptsByAgent.set(dto.agentId, []);
    }
    this.receiptsByAgent.get(dto.agentId).push(dto.taskId);

    return receipt;
  }

  async findByTaskId(taskId: string): Promise<ReceiptEntity | null> {
    return this.receipts.get(taskId) || null;
  }

  async findByAgentId(agentId: string): Promise<ReceiptEntity[]> {
    const taskIds = this.receiptsByAgent.get(agentId) || [];
    return taskIds
      .map((taskId) => this.receipts.get(taskId))
      .filter((receipt): receipt is ReceiptEntity => receipt !== undefined);
  }

  async updateCid(taskId: string, cid: string): Promise<ReceiptEntity | null> {
    const receipt = this.receipts.get(taskId);
    if (!receipt) {
      return null;
    }

    receipt.cid = cid;
    receipt.updateTimestamp();
    return receipt;
  }

  async verifyCid(taskId: string, expectedHash: string): Promise<boolean> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) {
      return false;
    }
    return receipt.outputHash === expectedHash;
  }
}
