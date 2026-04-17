import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptEntity } from './receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
  ) { }

  async create(dto: CreateReceiptDto): Promise<ReceiptEntity> {
    const receipt = this.receiptRepository.create({
      agentId: dto.agentId,
      taskId: dto.taskId,
      outputHash: dto.outputHash,
      timestamp: dto.timestamp,
      attested: false,
    });
    return this.receiptRepository.save(receipt);
  }

  async findByTaskId(taskId: string): Promise<ReceiptEntity | null> {
    return this.receiptRepository.findOne({ where: { taskId } });
  }

  async findByAgentId(agentId: string): Promise<ReceiptEntity[]> {
    return this.receiptRepository.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateCid(taskId: string, cid: string): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;
    receipt.cid = cid;
    return this.receiptRepository.save(receipt);
  }

  // Called by AttestationService after successfully submitting on-chain
  async markAttested(
    taskId: string,
    attestationTx: string,
    score: number,
  ): Promise<ReceiptEntity | null> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return null;
    receipt.attested = true;
    receipt.attestationTx = attestationTx;
    receipt.attestationScore = score;
    return this.receiptRepository.save(receipt);
  }

  // Find receipts that have been uploaded (have a CID) but not yet attested on-chain
  async findPendingAttestation(): Promise<ReceiptEntity[]> {
    return this.receiptRepository.find({
      where: { attested: false },
      order: { createdAt: 'ASC' },
      take: 10, // process in batches
    });
  }

  async verifyCid(taskId: string, expectedHash: string): Promise<boolean> {
    const receipt = await this.findByTaskId(taskId);
    if (!receipt) return false;
    return receipt.outputHash === expectedHash;
  }
}