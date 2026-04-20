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
import { VerificationService } from './verification.service';
import { ExecutionReceipt } from './interfaces/capability-template.interface';

@Controller('verification')
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(private readonly verificationService: VerificationService) {}

  /**
   * Verify a receipt against a capability template
   * POST /verification/verify
   */
  @Post('verify')
  async verifyReceipt(
    @Body() body: { receipt: ExecutionReceipt; templateId: string },
  ) {
    try {
      const { receipt, templateId } = body;

      if (!receipt || !templateId) {
        throw new HttpException(
          'Missing required fields: receipt and templateId',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.verificationService.verifyReceipt(
        receipt,
        templateId,
      );

      return {
        taskId: receipt.task_id,
        agentId: receipt.agent_id,
        templateId,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Verification failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Verification failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify a receipt from Arweave CID
   * GET /verification/arweave/:cid/:templateId
   */
  @Get('arweave/:cid/:templateId')
  async verifyFromArweave(
    @Param('cid') cid: string,
    @Param('templateId') templateId: string,
  ) {
    try {
      const result = await this.verificationService.verifyReceiptFromArweave(
        cid,
        templateId,
      );

      return {
        cid,
        templateId,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Arweave verification failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Arweave verification failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch verify multiple receipts
   * POST /verification/batch
   */
  @Post('batch')
  async verifyBatch(
    @Body() body: { receipts: ExecutionReceipt[]; templateId: string },
  ) {
    try {
      const { receipts, templateId } = body;

      if (!receipts || !Array.isArray(receipts) || !templateId) {
        throw new HttpException(
          'Missing required fields: receipts (array) and templateId',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.verificationService.verifyBatch(
        receipts,
        templateId,
      );

      // Convert Map to object for JSON response
      const resultsObj: Record<string, any> = {};
      results.forEach((value, key) => {
        resultsObj[key] = value;
      });

      return {
        templateId,
        totalReceipts: receipts.length,
        results: resultsObj,
      };
    } catch (error) {
      this.logger.error(`Batch verification failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Batch verification failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check
   * GET /verification/health
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'verification',
      timestamp: new Date().toISOString(),
    };
  }
}
