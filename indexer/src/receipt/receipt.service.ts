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
    const receipt = this.receiptRepository.create({
      agentId: dto.agentId,
      taskId: dto.taskId,
      outputHash: dto.outputHash,
      timestamp: dto.timestamp,
    });

    return this.receiptRepository.save(receipt);
  }

  async findByTaskId(taskId: string): Promise<ReceiptEntity | null> {
    return this.receiptRepository.findOne({ where: { taskId } });
  }

  async findByAgentId(agentId: string): Promise<ReceiptEntity[]> {
    return this.receiptRepository.find({ where: { agentId } });
  }

  async updateCid(taskId: string, cid: string): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) {
      return null;
    }

    receipt.cid = cid;
    return this.receiptRepository.save(receipt);
  }

  async verifyCid(taskId: string, expectedHash: string): Promise<boolean> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) {
      return false;
    }
    return receipt.outputHash === expectedHash;
  }
}
