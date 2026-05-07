import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@dolores/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SolanaModule } from './solana/solana.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { TasksModule } from './tasks/tasks.module';
import { ChallengesModule } from './challenges/challenges.module';
import { SyncModule } from './sync/sync.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ChallengesModule as AttestationChallengesModule } from './attestation/attestation.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    SolanaModule,
    AuthModule,
    AgentsModule,
    TasksModule,
    ChallengesModule,
    SyncModule,
    AttestationChallengesModule,
    IpfsModule,
    ReceiptsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }