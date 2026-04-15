import { Injectable, Logger } from '@nestjs/common';
import { ArweaveService } from '@dolores/receipt/services/arweave.service';
import { ExecutionReceipt } from '@dolores/receipt/interfaces/execution-receipt.interface';
import { createHash } from 'crypto';

@Injectable()
export class ReceiptIpfsService {
  private readonly logger = new Logger(ReceiptIpfsService.name);

  constructor(private readonly arweaveService: ArweaveService) {}

  /**
   * Pin receipt to Arweave and return CID (transaction ID)
   */
  async pinReceiptToIpfs(receipt: ExecutionReceipt): Promise<string> {
    try {
      // Canonicalize JSON (sort keys alphabetically) for deterministic hashing
      const canonicalJson = JSON.stringify(
        receipt,
        Object.keys(receipt).sort(),
      );

      // Upload to Arweave
      const txId = await this.arweaveService.upload(canonicalJson);

      this.logger.log(
        `Receipt pinned to Arweave for task ${receipt.task_id}: ${txId}`,
      );

      return txId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to pin receipt for task ${receipt.task_id}:`,
        error,
      );
      throw new Error(`Failed to pin receipt to Arweave: ${errorMessage}`);
    }
  }

  /**
   * Retrieve receipt from Arweave by CID (transaction ID)
   */
  async retrieveReceipt(cid: string): Promise<ExecutionReceipt> {
    try {
      const data = await this.arweaveService.retrieve(cid);
      return JSON.parse(data) as ExecutionReceipt;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to retrieve receipt ${cid}:`, error);
      throw new Error(
        `Failed to retrieve receipt from Arweave: ${errorMessage}`,
      );
    }
  }

  /**
   * Compute output hash from execution receipt
   * Uses SHA-256 of canonical JSON (keys sorted alphabetically)
   */
  computeOutputHash(receipt: ExecutionReceipt): string {
    const canonicalJson = JSON.stringify(receipt, Object.keys(receipt).sort());
    return createHash('sha256').update(canonicalJson).digest('hex');
  }

  /**
   * Verify that a receipt matches the expected output hash
   */
  async verifyReceipt(cid: string, expectedHash: string): Promise<boolean> {
    try {
      const receipt = await this.retrieveReceipt(cid);
      const actualHash = this.computeOutputHash(receipt);
      return actualHash === expectedHash;
    } catch (error) {
      this.logger.error(`Failed to verify receipt ${cid}:`, error);
      return false;
    }
  }

  /**
   * Check transaction status on Arweave
   */
  async getStatus(cid: string) {
    return this.arweaveService.getStatus(cid);
  }
}
