import { ExecutionReceipt } from '@dolores/receipt/interfaces/execution-receipt.interface';
import { ReceiptService } from '@dolores/receipt/receipt.service';
import { ReceiptIpfsService } from '@dolores/receipt/services/receipt.ipfs.service';
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

export interface UploadReceiptResponse {
  cid: string;
  taskId: string;
  agentId: string;
  outputHash: string;
}

@Controller('receipts')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(
    private readonly receiptService: ReceiptService,
    private readonly ipfsService: ReceiptIpfsService,
  ) {}

  @Post('upload')
  async uploadReceipt(
    @Body() executionReceipt: ExecutionReceipt,
  ): Promise<UploadReceiptResponse> {
    try {
      // Validate required fields
      if (
        !executionReceipt.agent_id ||
        !executionReceipt.task_id ||
        !executionReceipt.timestamp_unix
      ) {
        throw new HttpException(
          'Missing required fields in execution receipt',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Compute output hash from full receipt
      const outputHash = this.ipfsService.computeOutputHash(executionReceipt);

      // Upload full receipt to Arweave (IPFS)
      const cid = await this.ipfsService.pinReceiptToIpfs(executionReceipt);

      // Store minimal metadata + CID in database
      const receipt = await this.receiptService.create({
        agentId: executionReceipt.agent_id,
        taskId: executionReceipt.task_id,
        outputHash,
        timestamp: executionReceipt.timestamp_unix,
      });

      await this.receiptService.updateCid(receipt.taskId, cid);

      this.logger.log(
        `Receipt uploaded for task ${receipt.taskId}, CID: ${cid}`,
      );

      return {
        cid,
        taskId: receipt.taskId,
        agentId: receipt.agentId,
        outputHash,
      };
    } catch (error) {
      this.logger.error('Failed to upload receipt:', error);
      throw new HttpException(
        error.message || 'Failed to upload receipt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':taskId')
  async getReceipt(@Param('taskId') taskId: string): Promise<ExecutionReceipt> {
    const receipt = await this.receiptService.findByTaskId(taskId);

    if (!receipt || !receipt.cid) {
      throw new HttpException(
        `Receipt not found for taskId: ${taskId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      // Retrieve full receipt from Arweave
      const executionReceipt = await this.ipfsService.retrieveReceipt(
        receipt.cid,
      );

      // Verify the hash matches
      const isValid = await this.ipfsService.verifyReceipt(
        receipt.cid,
        receipt.outputHash,
      );

      if (!isValid) {
        this.logger.warn(
          `Hash mismatch for receipt ${taskId}, CID: ${receipt.cid}`,
        );
      }

      return executionReceipt;
    } catch (error) {
      this.logger.error(`Failed to retrieve receipt ${taskId}:`, error);
      throw new HttpException(
        'Failed to retrieve receipt from Arweave',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

  @Get('verify/:taskId')
  async verifyReceipt(@Param('taskId') taskId: string) {
    const receipt = await this.receiptService.findByTaskId(taskId);

    if (!receipt || !receipt.cid) {
      throw new HttpException(
        `Receipt not found for taskId: ${taskId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const isValid = await this.ipfsService.verifyReceipt(
      receipt.cid,
      receipt.outputHash,
    );

    return {
      taskId,
      cid: receipt.cid,
      verified: isValid,
      outputHash: receipt.outputHash,
    };
  }
}
