import { Injectable, Logger } from '@nestjs/common';
import {
  ConstraintViolation,
  ExecutionReceipt,
} from '../interfaces/capability-template.interface';
import { ParsedTransactionWithMeta } from '@solana/web3.js';

@Injectable()
export class BorrowValidator {
  private readonly logger = new Logger(BorrowValidator.name);

  /**
   * Validate borrow/supply-specific constraints
   */
  async validate(
    receipt: ExecutionReceipt,
    constraints: Record<string, any>,
    txData?: ParsedTransactionWithMeta,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const details = receipt.operation_details;

    // Check borrow amount limit
    if (constraints.max_borrow_amount_usdc !== undefined) {
      const borrowAmount =
        details.borrow_amount_usdc || details.amount_usdc || 0;

      if (borrowAmount > constraints.max_borrow_amount_usdc) {
        violations.push({
          rule: 'BORROW_AMOUNT_EXCEEDED',
          expected: constraints.max_borrow_amount_usdc,
          actual: borrowAmount,
          severity: 'critical',
        });
      }
    }

    // Check collateral ratio
    if (constraints.min_collateral_ratio_percent !== undefined) {
      const collateralRatio = details.collateral_ratio_percent || 0;

      if (collateralRatio < constraints.min_collateral_ratio_percent) {
        violations.push({
          rule: 'BORROW_COLLATERAL_RATIO_TOO_LOW',
          expected: constraints.min_collateral_ratio_percent,
          actual: collateralRatio,
          severity: 'critical',
          proof: {
            collateral_amount: details.collateral_amount,
            borrow_amount: details.borrow_amount,
          },
        });
      }
    }

    // Check interest rate
    if (constraints.max_interest_rate_percent !== undefined) {
      const interestRate = details.interest_rate_percent || details.apy || 0;

      if (interestRate > constraints.max_interest_rate_percent) {
        violations.push({
          rule: 'BORROW_INTEREST_RATE_TOO_HIGH',
          expected: constraints.max_interest_rate_percent,
          actual: interestRate,
          severity: 'high',
        });
      }
    }

    // Check supply amount limit
    if (constraints.max_supply_amount_usdc !== undefined) {
      const supplyAmount =
        details.supply_amount_usdc || details.amount_usdc || 0;

      if (supplyAmount > constraints.max_supply_amount_usdc) {
        violations.push({
          rule: 'SUPPLY_AMOUNT_EXCEEDED',
          expected: constraints.max_supply_amount_usdc,
          actual: supplyAmount,
          severity: 'critical',
        });
      }
    }

    return violations;
  }
}
