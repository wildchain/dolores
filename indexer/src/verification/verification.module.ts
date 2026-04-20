import { ReceiptModule } from '@dolores/receipt';
import { ConstraintCheckerService } from '@dolores/verification/services/constraint-checker.service';
import { SchemaValidatorService } from '@dolores/verification/services/schema-validator.service';
import { TransactionAnalyzerService } from '@dolores/verification/services/transaction-analyzer.service';
import { BorrowValidator } from '@dolores/verification/validators/borrow.validator';
import { StakeValidator } from '@dolores/verification/validators/stake.validator';
import { SwapValidator } from '@dolores/verification/validators/swap.validator';
import { TransferValidator } from '@dolores/verification/validators/transfer.validator';
import { VerificationController } from '@dolores/verification/verification.controller';
import { VerificationService } from '@dolores/verification/verification.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [ReceiptModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    SchemaValidatorService,
    ConstraintCheckerService,
    TransactionAnalyzerService,
    SwapValidator,
    BorrowValidator,
    StakeValidator,
    TransferValidator,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
