import { Injectable, Logger } from '@nestjs/common';
import { SchemaValidatorService } from './services/schema-validator.service';
import { ConstraintCheckerService } from './services/constraint-checker.service';
import { TransactionAnalyzerService } from './services/transaction-analyzer.service';
import {
  ExecutionReceipt,
  VerificationResult,
  ConstraintViolation,
} from './interfaces/capability-template.interface';
import * as fs from 'fs';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly schemaValidator: SchemaValidatorService,
    private readonly constraintChecker: ConstraintCheckerService,
    private readonly txAnalyzer: TransactionAnalyzerService,
  ) {}

  /**
   * Main verification entry point
   * Validates a receipt against its agent's capability template
   */
  async verifyReceipt(
    receipt: ExecutionReceipt,
    templateId: string,
  ): Promise<VerificationResult> {
    try {
      this.logger.log(
        `Verifying receipt ${receipt.task_id} with template ${templateId}`,
      );

      // 1. Load capability template
      const template =
        await this.schemaValidator.loadCapabilityTemplate(templateId);
      if (!template) {
        return {
          valid: false,
          violations: [
            {
              rule: 'TEMPLATE_NOT_FOUND',
              expected: `Template ${templateId}`,
              actual: 'Not found',
              severity: 'critical',
            },
          ],
        };
      }

      const allViolations: ConstraintViolation[] = [];

      // 2. Check if operation is allowed
      if (
        !this.schemaValidator.isOperationAllowed(
          receipt.operation_type,
          template,
        )
      ) {
        allViolations.push({
          rule: 'OPERATION_NOT_ALLOWED',
          expected: template.allowed_operations.map((op) => op.operation_type),
          actual: receipt.operation_type,
          severity: 'critical',
        });
        return { valid: false, violations: allViolations };
      }

      // 3. Validate operation schema
      const schemaResult = await this.schemaValidator.validateOperationSchema(
        receipt,
        template,
      );
      if (!schemaResult.valid && schemaResult.violations) {
        allViolations.push(...schemaResult.violations);
      }

      // 4. Validate program whitelist
      const programResult = this.schemaValidator.validateProgramWhitelist(
        receipt,
        template,
      );
      if (!programResult.valid && programResult.violations) {
        allViolations.push(...programResult.violations);
      }

      // 5. Fetch on-chain transaction data (if available)
      let txData: any = null;
      if (receipt.execution.tx_signatures?.length > 0) {
        txData = await this.txAnalyzer.getTransaction(
          receipt.execution.tx_signatures[0],
        );
      }

      // 6. Check operation-specific constraints
      const operationViolations =
        await this.constraintChecker.checkOperationConstraints(
          receipt,
          template,
          txData,
        );
      allViolations.push(...operationViolations);

      // 7. Check global constraints
      const globalViolations =
        await this.constraintChecker.checkGlobalConstraints(receipt, template);
      allViolations.push(...globalViolations);

      // 8. Return result
      if (allViolations.length > 0) {
        this.logger.warn(
          `Violations found for ${receipt.task_id}: ${allViolations.length} issues`,
        );
        return {
          valid: false,
          violations: allViolations,
        };
      }

      this.logger.log(`Receipt ${receipt.task_id} passed verification`);
      return { valid: true };
    } catch (error) {
      this.logger.error(
        `Verification error for ${receipt.task_id}: ${error.message}`,
      );
      return {
        valid: false,
        violations: [
          {
            rule: 'VERIFICATION_ERROR',
            expected: 'Successful verification',
            actual: error.message,
            severity: 'critical',
          },
        ],
      };
    }
  }

  /**
   * Verify receipt from Arweave CID
   */
  async verifyReceiptFromArweave(
    cid: string,
    templateId: string,
  ): Promise<VerificationResult> {
    try {
      // In production, fetch from Arweave
      // For now, stub implementation
      this.logger.warn(`Arweave fetching not yet implemented for CID: ${cid}`);

      return {
        valid: false,
        violations: [
          {
            rule: 'ARWEAVE_FETCH_NOT_IMPLEMENTED',
            expected: 'Receipt from Arweave',
            actual: 'Feature not implemented',
            severity: 'critical',
          },
        ],
      };
    } catch (error) {
      return {
        valid: false,
        violations: [
          {
            rule: 'ARWEAVE_FETCH_ERROR',
            expected: 'Receipt from Arweave',
            actual: error.message,
            severity: 'critical',
          },
        ],
      };
    }
  }

  /**
   * Batch verify multiple receipts
   */
  async verifyBatch(
    receipts: ExecutionReceipt[],
    templateId: string,
  ): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    for (const receipt of receipts) {
      const result = await this.verifyReceipt(receipt, templateId);
      results.set(receipt.task_id, result);
    }

    return results;
  }
}
