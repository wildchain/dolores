import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ReceiptModule } from '@dolores/receipt/receipt.module';
import { AttestationModule } from '@dolores/attestation/attestation.module';
import { VerificationModule } from '@dolores/verification/verification.module';
import { ChallengeModule } from '@dolores/challenge/challenge.module';

@Module({
  imports: [
    ReceiptModule,
    AttestationModule,
    VerificationModule,
    ChallengeModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
