import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { AttestationService } from '@dolores/attestation/attestation.service';
import type { CreateReceiptDto } from './dto/create-receipt.dto';
import { ReceiptEntity } from './receipt.entity';
import * as nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

export interface UploadReceiptResponse {
  cid: string;
  taskId: string;
  agentId: string;
  submissionTx: string | null;
  pendingAttestationPda: string | null;
}

@Controller('receipts')
export class ReceiptController {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly attestationService: AttestationService,
  ) {}

  @Post('upload')
  async uploadReceipt(
    @Body() dto: CreateReceiptDto,
  ): Promise<UploadReceiptResponse> {
    const outputHashBytes = Buffer.from(
      dto.outputHash.replace(/^0x/, ''),
      'hex',
    );
    const signatureBytes = Buffer.from(
      dto.agentSignature.replace(/^0x/, ''),
      'hex',
    );
    const agentPubkeyBytes = new PublicKey(dto.agentId).toBytes();

    const valid = nacl.sign.detached.verify(
      outputHashBytes,
      signatureBytes,
      agentPubkeyBytes,
    );

    if (!valid) {
      throw new HttpException(
        'Invalid agent signature — receipt rejected',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const receipt = await this.receiptService.create(dto);

    const cid = `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
    await this.receiptService.updateCid(receipt.taskId, cid);
    receipt.cid = cid;

    const submission =
      await this.attestationService.submitPendingAttestation(receipt);

    if (submission.signature && submission.pendingAttestationPda) {
      await this.receiptService.markPendingReview(
        receipt.taskId,
        submission.pendingAttestationPda,
        submission.signature,
      );
    } else {
      await this.receiptService.markSubmissionFailed(receipt.taskId);
    }

    return {
      cid,
      taskId: receipt.taskId,
      agentId: receipt.agentId,
      submissionTx: submission.signature,
      pendingAttestationPda: submission.pendingAttestationPda,
    };
  }

  @Get(':taskId')
  async getReceipt(@Param('taskId') taskId: string): Promise<ReceiptEntity> {
    const receipt = await this.receiptService.findByTaskId(taskId);
    if (!receipt) {
      throw new HttpException(
        `Receipt not found for taskId: ${taskId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return receipt;
  }

  @Get('agent/:agentId')
  async getReceiptsByAgent(
    @Param('agentId') agentId: string,
  ): Promise<ReceiptEntity[]> {
    const receipts = await this.receiptService.findByAgentId(agentId);
    if (!receipts || receipts.length === 0) {
      throw new HttpException(
        `No receipts found for agentId: ${agentId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return receipts;
  }
}
