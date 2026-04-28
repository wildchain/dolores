import { Injectable, Logger } from '@nestjs/common';
import {
  ConstraintViolation,
  ExecutionReceipt,
} from '../interfaces/capability-template.interface';
import { ParsedTransactionWithMeta } from '@solana/web3.js';

@Injectable()
export class StakeValidator {
  private readonly logger = new Logger(StakeValidator.name);

  /**
   * Validate stake-specific constraints
   */
  async validate(
    receipt: ExecutionReceipt,
    constraints: Record<string, any>,
    txData?: ParsedTransactionWithMeta,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const details = receipt.operation_details;

    // Check stake amount limit
    if (constraints.max_stake_amount_usdc !== undefined) {
      const stakeAmount = details.stake_amount_usdc || details.amount_usdc || 0;

      if (stakeAmount > constraints.max_stake_amount_usdc) {
        violations.push({
          rule: 'STAKE_AMOUNT_EXCEEDED',
          expected: constraints.max_stake_amount_usdc,
          actual: stakeAmount,
          severity: 'critical',
        });
      }
    }

    // Check lock period
    if (constraints.max_lock_period_seconds !== undefined) {
      const lockPeriod =
        details.lock_period_seconds || details.lock_duration || 0;

      if (lockPeriod > constraints.max_lock_period_seconds) {
        violations.push({
          rule: 'STAKE_LOCK_PERIOD_EXCEEDED',
          expected: constraints.max_lock_period_seconds,
          actual: lockPeriod,
          severity: 'high',
          proof: {
            lock_period_days: Math.floor(lockPeriod / 86400),
            max_allowed_days: Math.floor(
              constraints.max_lock_period_seconds / 86400,
            ),
          },
        });
      }
    }

    // Check minimum APY if specified
    if (constraints.min_apy_percent !== undefined) {
      const apy = details.apy_percent || details.apy || 0;

      if (apy < constraints.min_apy_percent) {
        violations.push({
          rule: 'STAKE_APY_TOO_LOW',
          expected: constraints.min_apy_percent,
          actual: apy,
          severity: 'medium',
        });
      }
    }

    return violations;
  }
}
