import { Injectable, Logger } from '@nestjs/common';
import {
  CapabilityTemplate,
  ConstraintViolation,
  ExecutionReceipt,
} from '../interfaces/capability-template.interface';
import { SwapValidator } from '../validators/swap.validator';
import { BorrowValidator } from '../validators/borrow.validator';
import { StakeValidator } from '../validators/stake.validator';
import { TransferValidator } from '../validators/transfer.validator';

@Injectable()
export class ConstraintCheckerService {
  private readonly logger = new Logger(ConstraintCheckerService.name);

  constructor(
    private readonly swapValidator: SwapValidator,
    private readonly borrowValidator: BorrowValidator,
    private readonly stakeValidator: StakeValidator,
    private readonly transferValidator: TransferValidator,
  ) {}

  /**
   * Check operation-specific constraints based on operation_type
   */
  async checkOperationConstraints(
    receipt: ExecutionReceipt,
    template: CapabilityTemplate,
    txData?: any,
  ): Promise<ConstraintViolation[]> {
    const operationConfig = template.allowed_operations.find(
      (op) => op.operation_type === receipt.operation_type,
    );

    if (!operationConfig) {
      return [];
    }

    const constraints = operationConfig.constraints;

    // Route to specific validator based on operation type
    switch (receipt.operation_type) {
      case 'swap':
        return this.swapValidator.validate(receipt, constraints, txData);
      case 'borrow':
      case 'supply':
        return this.borrowValidator.validate(receipt, constraints, txData);
      case 'stake':
        return this.stakeValidator.validate(receipt, constraints, txData);
      case 'transfer':
        return this.transferValidator.validate(receipt, constraints, txData);
      default:
        this.logger.warn(
          `No validator for operation type: ${receipt.operation_type}`,
        );
        return [];
    }
  }

  /**
   * Check global constraints that apply to all operations
   */
  async checkGlobalConstraints(
    receipt: ExecutionReceipt,
    template: CapabilityTemplate,
  ): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];
    const { global_constraints } = template;

    // Check max single transaction USDC limit
    if (global_constraints.max_single_transaction_usdc) {
      const transactionValue = this.calculateTransactionValueUSDC(receipt);
      if (transactionValue > global_constraints.max_single_transaction_usdc) {
        violations.push({
          rule: 'MAX_TRANSACTION_LIMIT_EXCEEDED',
          expected: global_constraints.max_single_transaction_usdc,
          actual: transactionValue,
          severity: 'critical',
        });
      }
    }

    // Check deadline requirement
    if (global_constraints.require_deadline) {
      const hasDeadline = this.checkDeadlinePresent(receipt);
      if (!hasDeadline) {
        violations.push({
          rule: 'DEADLINE_REQUIRED',
          expected: 'Transaction must include deadline',
          actual: 'No deadline found',
          severity: 'high',
        });
      }
    }

    return violations;
  }

  /**
   * Calculate transaction value in USDC micro-units
   * This is a placeholder - in production would use oracle prices
   */
  private calculateTransactionValueUSDC(receipt: ExecutionReceipt): number {
    // Extract from operation_details or token_transfers
    if (receipt.operation_details?.amount_usdc) {
      return receipt.operation_details.amount_usdc;
    }

    // Sum all token transfers (simplified)
    if (receipt.execution.token_transfers) {
      return receipt.execution.token_transfers.reduce(
        (sum, transfer) => sum + transfer.amount,
        0,
      );
    }

    return 0;
  }

  /**
   * Check if deadline is present in operation details
   */
  private checkDeadlinePresent(receipt: ExecutionReceipt): boolean {
    return (
      receipt.operation_details?.deadline !== undefined ||
      receipt.operation_details?.deadline_unix !== undefined
    );
  }
}
