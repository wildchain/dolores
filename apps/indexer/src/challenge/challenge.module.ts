import { Module } from '@nestjs/common';
import { AttestationModule } from '@dolores/attestation/attestation.module';
import { ReceiptModule } from '@dolores/receipt';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';

@Module({
  imports: [AttestationModule, ReceiptModule],
  controllers: [ChallengeController],
  providers: [ChallengeService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
