import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@dolores/lib/database';
import { ReceiptModule } from './receipt/receipt.module';
import { AgentModule } from '@dolores/agent/agent.module';
import { VerificationModule } from './verification/verification.module';
import { ChallengeModule } from './challenge/challenge.module';
import { ReviewWorkerModule } from './worker/review-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ReceiptModule,
    AgentModule,
    VerificationModule,
    ChallengeModule,
    ReviewWorkerModule,
  ],
})
export class AppModule {}
