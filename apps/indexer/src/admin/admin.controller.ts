import {
  Controller,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ReceiptService } from '@dolores/receipt/receipt.service';
import { AttestationService } from '@dolores/attestation/attestation.service';
import { VerificationService } from '@dolores/verification/verification.service';
import { ChallengeService } from '@dolores/challenge/challenge.service';
import { CreateChallengeDto } from '@dolores/shared';
import { ExecutionReceipt } from '@dolores/verification/interfaces/capability-template.interface';

/**
 * Admin Controller
 * Manual testing/debugging endpoints - NOT for production use
 * These operations are normally handled automatically by ReviewWorker
 */
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly receiptService: ReceiptService,
    private readonly attestationService: AttestationService,
    private readonly verificationService: VerificationService,
    private readonly challengeService: ChallengeService,
  ) {}

  /**
   * Manual approval (normally handled by ReviewWorker)
   * POST /admin/receipts/:taskId/approve
   */
  @Post('receipts/:taskId/approve')
  async manualApprove(
    @Param('taskId') taskId: string,
  ): Promise<{ approvalTx: string }> {
    this.logger.warn(`Manual approval triggered for ${taskId}`);

    const receipt = await this.receiptService.findByTaskId(taskId);
    if (!receipt) {
      throw new HttpException(
        `Receipt not found for taskId: ${taskId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const approvalTx =
      await this.attestationService.approveAttestation(receipt);
    if (!approvalTx) {
      throw new HttpException(
        `Failed to approve pending attestation for taskId: ${taskId}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    await this.receiptService.markApproved(
      taskId,
      approvalTx,
      this.attestationService.getReviewerPublicKey(),
    );

    return { approvalTx };
  }

  /**
   * Manual challenge (normally handled by ReviewWorker)
   * POST /admin/challenges/submit
   */
  @Post('challenges/submit')
  async manualChallenge(@Body() dto: CreateChallengeDto) {
    this.logger.warn(`Manual challenge triggered for ${dto.taskId}`);
    return this.challengeService.submitChallenge(dto);
  }

  /**
   * Manual verification (normally handled by ReviewWorker)
   * POST /admin/verification/verify
   */
  @Post('verification/verify')
  async manualVerify(
    @Body() body: { receipt: ExecutionReceipt; templateId: string },
  ) {
    this.logger.warn(
      `Manual verification triggered for ${body.receipt.task_id}`,
    );

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
  }

  /**
   * Batch verification
   * POST /admin/verification/batch
   */
  @Post('verification/batch')
  async batchVerify(
    @Body() body: { receipts: ExecutionReceipt[]; templateId: string },
  ) {
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

    const resultsObj: Record<string, any> = {};
    results.forEach((value, key) => {
      resultsObj[key] = value;
    });

    return {
      templateId,
      totalReceipts: receipts.length,
      results: resultsObj,
    };
  }

  /**
   * Retry failed attestation submissions
   * POST /admin/receipts/retry-submissions
   */
  @Post('receipts/retry-submissions')
  async retrySubmissions(): Promise<{ message: string }> {
    this.logger.warn('Manual retry of pending submissions triggered');

    const pending = await this.receiptService.findPendingSubmission();
    await this.attestationService.processPendingSubmissions(pending);

    return { message: `Processed ${pending.length} pending submissions` };
  }
}
