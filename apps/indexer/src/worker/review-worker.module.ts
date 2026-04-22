import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReviewWorkerService } from './review-worker.service';
import { ReceiptModule } from '@dolores/receipt/receipt.module';
import { AttestationModule } from '@dolores/attestation/attestation.module';
import { VerificationModule } from '@dolores/verification/verification.module';
import { ChallengeModule } from '@dolores/challenge/challenge.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ReceiptModule,
    AttestationModule,
    VerificationModule,
    ChallengeModule,
  ],
  providers: [ReviewWorkerService],
  exports: [ReviewWorkerService],
})
export class ReviewWorkerModule {}
