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
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { ReceiptEntity } from './receipt.entity';

export interface UploadReceiptResponse {
  cid: string;
  taskId: string;
  agentId: string;
}

@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post('upload')
  async uploadReceipt(
    @Body() dto: CreateReceiptDto,
  ): Promise<UploadReceiptResponse> {
    // Create receipt in database
    const receipt = await this.receiptService.create(dto);

    // TODO: Upload to Pinata (IPFS)
    // const cid = await this.pinataService.upload(receipt);
    const cid = `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`; // Placeholder

    // Store CID mapping
    await this.receiptService.updateCid(receipt.taskId, cid);

    return {
      cid,
      taskId: receipt.taskId,
      agentId: receipt.agentId,
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

    // TODO: Add CID verification (hash check against on-chain output_hash)

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
