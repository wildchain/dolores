import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReceiptService } from '@dolores/receipt/receipt.service';
import { AttestationService } from '@dolores/attestation/attestation.service';
import { VerificationService } from '@dolores/verification/verification.service';
import { ChallengeService } from '@dolores/challenge/challenge.service';
import { ReceiptEntity } from '@dolores/receipt/receipt.entity';
import { ExecutionReceipt } from '@dolores/verification/interfaces/capability-template.interface';
import * as crypto from 'crypto';

@Injectable()
export class ReviewWorkerService {
  private readonly logger = new Logger(ReviewWorkerService.name);
  private isProcessing = false;

  constructor(
    private readonly receiptService: ReceiptService,
    private readonly attestationService: AttestationService,
    private readonly verificationService: VerificationService,
    private readonly challengeService: ChallengeService,
  ) {}

  /**
   * Poll for pending reviews every 30 seconds
   * Automatically verify and approve/challenge attestations
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingReviews() {
    if (this.isProcessing) {
      this.logger.debug('Review worker already running, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const pending = await this.receiptService.findPendingReview();

      if (pending.length === 0) {
        this.logger.debug('No pending reviews to process');
        return;
      }

      this.logger.log(`Processing ${pending.length} pending reviews...`);

      for (const receipt of pending) {
        await this.processReceipt(receipt);
      }

      this.logger.log(`Completed processing ${pending.length} pending reviews`);
    } catch (error) {
      this.logger.error(
        `Error in review worker: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single receipt: verify and approve/challenge
   */
  private async processReceipt(receipt: ReceiptEntity): Promise<void> {
    try {
      this.logger.log(
        `Processing receipt ${receipt.taskId} from agent ${receipt.agentId}`,
      );

      // 1. Fetch full ExecutionReceipt from Arweave (or use mock data)
      const fullReceipt = await this.fetchReceiptFromArweave(receipt);
      if (!fullReceipt) {
        this.logger.warn(
          `Could not fetch receipt ${receipt.taskId} from Arweave CID ${receipt.cid}`,
        );
        return;
      }

      // 2. Determine template ID (for now, use agent's default template)
      // TODO: Fetch from agent's on-chain capability template reference
      const templateId = await this.getAgentTemplateId(receipt.agentId);

      // 3. Run verification
      const verificationResult = await this.verificationService.verifyReceipt(
        fullReceipt,
        templateId,
      );

      // 4. Auto-approve if valid
      if (verificationResult.valid) {
        await this.approveReceipt(receipt, verificationResult);
      }
      // 5. Auto-challenge if invalid
      else {
        await this.challengeReceipt(receipt, verificationResult);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process receipt ${receipt.taskId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Approve a valid receipt
   */
  private async approveReceipt(
    receipt: ReceiptEntity,
    verificationResult: any,
  ): Promise<void> {
    try {
      const approvalTx =
        await this.attestationService.approveAttestation(receipt);

      if (!approvalTx) {
        this.logger.warn(
          `On-chain approval failed for ${receipt.taskId} — marking locally approved`,
        );
      }

      await this.receiptService.markApproved(
        receipt.taskId,
        approvalTx ?? 'local-approval',
        this.attestationService.getReviewerPublicKey(),
        verificationResult,
      );

      this.logger.log(
        `✅ Receipt ${receipt.taskId} APPROVED${approvalTx ? ` — tx: ${approvalTx}` : ' (local only — agent registry not on-chain)'}`,
      );
    } catch (error) {
      this.logger.error(
        `Error approving receipt ${receipt.taskId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Challenge an invalid receipt
   */
  private async challengeReceipt(
    receipt: ReceiptEntity,
    verificationResult: any,
  ): Promise<void> {
    try {
      // Hash the violations to create violation_hash
      const violationHash = this.hashViolations(verificationResult.violations);

      const challenge = await this.challengeService.submitChallenge({
        taskId: receipt.taskId,
        violationHash,
        evidenceCid: receipt.cid ?? '',
        verificationOutcome: verificationResult,
      });

      this.logger.log(
        `⚠️  Receipt ${receipt.taskId} CHALLENGED — violations: ${verificationResult.violations.length}`,
      );
      this.logger.debug(
        `Violation details: ${JSON.stringify(verificationResult.violations, null, 2)}`,
      );
    } catch (error) {
      this.logger.error(
        `Error challenging receipt ${receipt.taskId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Fetch full ExecutionReceipt from Arweave
   * TODO: Replace with real Arweave client
   */
  private async fetchReceiptFromArweave(
    receipt: ReceiptEntity,
  ): Promise<ExecutionReceipt | null> {
    // For now, create a mock ExecutionReceipt from stored data
    // In production, fetch from Arweave using receipt.cid

    if (!receipt.cid) {
      this.logger.warn(`Receipt ${receipt.taskId} has no CID`);
      return null;
    }

    // Mock ExecutionReceipt (replace with actual Arweave fetch)
    const mockReceipt: ExecutionReceipt = {
      schema_version: '1.0.0',
      task_id: receipt.taskId,
      agent_id: receipt.agentId,
      operator: receipt.agentId, // Same as agent for now
      assigned_by: 'system',
      timestamp_unix: receipt.timestamp,
      operation_type: 'swap', // Default to swap for testing
      operation_details: {
        input_mint: 'So11111111111111111111111111111111111111112',
        output_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount_in: '1000000', // 0.001 SOL
        min_amount_out: '990', // 0.99 USDC with 1% slippage
        slippage: 1.0,
      },
      execution: {
        tx_signatures: [receipt.submissionTx ?? ''],
        programs_called: [
          'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
        ],
        instructions_executed: [],
        token_transfers: [],
      },
      result: {
        status: 'success',
        summary: 'Swapped SOL to USDC',
      },
    };

    this.logger.debug(
      `Fetched mock receipt for ${receipt.taskId} from CID ${receipt.cid}`,
    );

    return mockReceipt;
  }

  /**
   * Get agent's capability template ID
   * TODO: Fetch from on-chain agent registry
   */
  private async getAgentTemplateId(agentId: string): Promise<string> {
    // For now, return default template
    // In production, fetch from agent's on-chain RegistryAccount.arweave_cid
    return 'swap-basic-v1';
  }

  /**
   * Hash violations for on-chain challenge
   */
  private hashViolations(violations: any[]): string {
    const violationString = JSON.stringify(violations);
    const hash = crypto.createHash('sha256').update(violationString).digest();
    return '0x' + hash.toString('hex');
  }
}
