import { Controller, Post, Body } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { UploadReceiptDto } from './dto/upload-receipt.dto';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * POST /receipts/upload
   * Called by the agent after task execution. Pins the execution receipt to
   * IPFS and stores a outputHash → CID lookup for later attestation enrichment.
   */
  @Post('upload')
  async upload(
    @Body() dto: UploadReceiptDto,
  ): Promise<{ cid: string; attestationTx: null }> {
    return this.receiptsService.uploadReceipt(dto);
  }
}
