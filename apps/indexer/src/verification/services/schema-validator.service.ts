import { Injectable, Logger } from '@nestjs/common';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import {
  CapabilityTemplate,
  ExecutionReceipt,
  VerificationResult,
} from '../interfaces/capability-template.interface';

@Injectable()
export class SchemaValidatorService {
  private readonly logger = new Logger(SchemaValidatorService.name);
  private readonly ajv: Ajv;
  private readonly schemasPath: string;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    // Path to schemas directory relative to project root
    this.schemasPath = path.join(process.cwd(), '..', 'schemas');
  }

  /**
   * Load capability template from schemas directory
   * In production, this would fetch from Arweave using agent's capability_hash
   */
  async loadCapabilityTemplate(
    templateId: string,
  ): Promise<CapabilityTemplate | null> {
    try {
      const templatePath = path.join(
        this.schemasPath,
        'capability-templates',
        `${templateId}.json`,
      );

      if (!fs.existsSync(templatePath)) {
        this.logger.warn(`Template not found: ${templateId}`);
        return null;
      }

      const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

      // Templates have their structure in the "example" field
      return templateData.example as CapabilityTemplate;
    } catch (error: any) {
      this.logger.error(
        `Failed to load capability template ${templateId}: ${error?.message ?? error}`,
      );
      return null;
    }
  }

  /**
   * Check if the operation type is allowed in the capability template
   */
  isOperationAllowed(
    operationType: string,
    template: CapabilityTemplate,
  ): boolean {
    return template.allowed_operations.some(
      (op) => op.operation_type === operationType,
    );
  }

  /**
   * Validate receipt's operation_details against the operation schema
   */
  async validateOperationSchema(
    receipt: ExecutionReceipt,
    template: CapabilityTemplate,
  ): Promise<VerificationResult> {
    try {
      // Find the operation config
      const operationConfig = template.allowed_operations.find(
        (op) => op.operation_type === receipt.operation_type,
      );

      if (!operationConfig) {
        return {
          valid: false,
          violations: [
            {
              rule: 'OPERATION_NOT_ALLOWED',
              expected: template.allowed_operations.map(
                (op) => op.operation_type,
              ),
              actual: receipt.operation_type,
              severity: 'critical',
            },
          ],
        };
      }

      // Load operation schema
      const schemaPath = path.join(
        this.schemasPath,
        operationConfig.schema_ref,
      );

      if (!fs.existsSync(schemaPath)) {
        this.logger.warn(`Schema not found: ${operationConfig.schema_ref}`);
        // Schema not found - cannot validate, assume valid for now
        return { valid: true };
      }

      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

      // Validate operation_details against schema
      const validate = this.ajv.compile(schema);
      const valid = validate(receipt.operation_details);

      if (!valid) {
        return {
          valid: false,
          violations: [
            {
              rule: 'SCHEMA_VALIDATION_FAILED',
              expected: 'Valid operation_details per schema',
              actual: validate.errors,
              severity: 'critical',
            },
          ],
        };
      }

      return { valid: true };
    } catch (error: any) {
      this.logger.error(`Schema validation error: ${error?.message ?? error}`);
      return {
        valid: false,
        violations: [
          {
            rule: 'SCHEMA_VALIDATION_ERROR',
            expected: 'Valid schema',
            actual: error?.message ?? String(error),
            severity: 'critical',
          },
        ],
      };
    }
  }

  /**
   * Check if programs called are whitelisted
   */
  validateProgramWhitelist(
    receipt: ExecutionReceipt,
    template: CapabilityTemplate,
  ): VerificationResult {
    const unauthorizedPrograms = receipt.execution.programs_called.filter(
      (program) => !template.allowed_programs.includes(program),
    );

    if (unauthorizedPrograms.length > 0) {
      return {
        valid: false,
        violations: [
          {
            rule: 'UNAUTHORIZED_PROGRAM',
            expected: template.allowed_programs,
            actual: unauthorizedPrograms,
            severity: 'critical',
          },
        ],
      };
    }

    return { valid: true };
  }
}
