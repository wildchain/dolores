import { Injectable, Logger } from '@nestjs/common';
import {
  ConstraintViolation,
  ExecutionReceipt,
} from '../interfaces/capability-template.interface';
import { ParsedTransactionWithMeta } from '@solana/web3.js';

@Injectable()
export class SwapValidator {
  private readonly logger = new Logger(SwapValidator.name);

  /**
   * Validate swap-specific constraints
   */
  async validate(
    receipt: ExecutionReceipt,
    constraints: Record<string, any>,
    txData?: ParsedTransactionWithMeta,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const details = receipt.operation_details;

    // Check slippage tolerance
    if (constraints.max_slippage_percent !== undefined) {
      const actualSlippage =
        details.actual_slippage || details.slippage_tolerance || 0;

      if (actualSlippage > constraints.max_slippage_percent) {
        violations.push({
          rule: 'SWAP_SLIPPAGE_EXCEEDED',
          expected: constraints.max_slippage_percent,
          actual: actualSlippage,
          severity: 'critical',
          proof: {
            expected_output: details.expected_output,
            actual_output: details.actual_output,
            input_amount: details.input_amount,
          },
        });
      }
    }

    // Check route hops
    if (constraints.max_route_hops !== undefined) {
      const routeHops = details.route_hops || details.route?.length || 0;

      if (routeHops > constraints.max_route_hops) {
        violations.push({
          rule: 'SWAP_ROUTE_HOPS_EXCEEDED',
          expected: constraints.max_route_hops,
          actual: routeHops,
          severity: 'high',
        });
      }
    }

    // Check price impact
    if (constraints.max_price_impact_percent !== undefined) {
      const priceImpact = details.price_impact_percent || 0;

      if (priceImpact > constraints.max_price_impact_percent) {
        violations.push({
          rule: 'SWAP_PRICE_IMPACT_EXCEEDED',
          expected: constraints.max_price_impact_percent,
          actual: priceImpact,
          severity: 'critical',
        });
      }
    }

    // Check transfer amount limits
    if (constraints.max_transfer_amount_usdc !== undefined) {
      const transferAmount =
        details.input_amount_usdc || details.input_amount || 0;

      if (transferAmount > constraints.max_transfer_amount_usdc) {
        violations.push({
          rule: 'SWAP_AMOUNT_LIMIT_EXCEEDED',
          expected: constraints.max_transfer_amount_usdc,
          actual: transferAmount,
          severity: 'critical',
        });
      }
    }

    return violations;
  }
}
