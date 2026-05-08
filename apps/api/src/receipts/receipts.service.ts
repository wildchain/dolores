import { Injectable, Logger } from '@nestjs/common';
import { RocksDBService } from '@dolores/database';
import { IpfsService } from '../ipfs/ipfs.service';
import { UploadReceiptDto } from './dto/upload-receipt.dto';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly rocksdb: RocksDBService,
    private readonly ipfs: IpfsService,
  ) {}

  async uploadReceipt(
    dto: UploadReceiptDto,
  ): Promise<{ cid: string; attestationTx: null }> {
    const receipt = {
      schema_version: '1.0',
      task_id: dto.taskId,
      agent_id: dto.agentId,
      instruction: dto.instruction,
      timestamp_unix: dto.timestamp,
      execution: { tx_signature: dto.txSignature },
      result: { status: dto.resultStatus, summary: dto.resultSummary },
    };

    const cid = await this.ipfs.pinManifest(receipt);

    // Store outputHash → CID for later lookup when attestation event arrives
    await this.rocksdb.put(`receipt-cid:${dto.outputHash}`, cid);

    this.logger.log(`Receipt pinned: outputHash=${dto.outputHash} cid=${cid}`);

    return { cid, attestationTx: null };
  }
}
