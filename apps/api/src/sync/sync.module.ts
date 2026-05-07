import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AgentsModule } from '../agents/agents.module';
import { TasksModule } from '../tasks/tasks.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { ChallengesModule as AttestationChallengesModule } from '../attestation/attestation.module';

@Module({
  imports: [AgentsModule, TasksModule, ChallengesModule, AttestationChallengesModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule { }