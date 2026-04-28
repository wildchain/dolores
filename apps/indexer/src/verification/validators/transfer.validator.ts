import { Injectable, Logger } from '@nestjs/common';
import {
  ConstraintViolation,
  ExecutionReceipt,
} from '../interfaces/capability-template.interface';
import { ParsedTransactionWithMeta } from '@solana/web3.js';

@Injectable()
export class TransferValidator {
  private readonly logger = new Logger(TransferValidator.name);

  /**
   * Validate transfer-specific constraints
   */
  async validate(
    receipt: ExecutionReceipt,
    constraints: Record<string, any>,
    txData?: ParsedTransactionWithMeta,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const details = receipt.operation_details;

    // Check transfer amount limit
    if (constraints.max_transfer_amount_usdc !== undefined) {
      const transferAmount =
        details.transfer_amount_usdc || details.amount_usdc || 0;

      if (transferAmount > constraints.max_transfer_amount_usdc) {
        violations.push({
          rule: 'TRANSFER_AMOUNT_EXCEEDED',
          expected: constraints.max_transfer_amount_usdc,
          actual: transferAmount,
          severity: 'critical',
        });
      }
    }

    // Check recipient whitelist
    if (constraints.recipient_whitelist_enabled === true) {
      const recipient = details.recipient || details.to_address;
      const whitelist = constraints.recipient_whitelist || [];

      if (recipient && !whitelist.includes(recipient)) {
        violations.push({
          rule: 'TRANSFER_RECIPIENT_NOT_WHITELISTED',
          expected: 'Recipient in whitelist',
          actual: recipient,
          severity: 'critical',
          proof: {
            recipient,
            whitelist_enabled: true,
            whitelist_size: whitelist.length,
          },
        });
      }
    }

    // Check token mint if specified
    if (constraints.allowed_tokens) {
      const token = details.token_mint || details.mint;

      if (token && !constraints.allowed_tokens.includes(token)) {
        violations.push({
          rule: 'TRANSFER_TOKEN_NOT_ALLOWED',
          expected: constraints.allowed_tokens,
          actual: token,
          severity: 'high',
        });
      }
    }

    return violations;
  }
}
