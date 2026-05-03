import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AgentsModule } from '../agents/agents.module';
import { TasksModule } from '../tasks/tasks.module';
import { ChallengesModule } from '../attestation/challenges/challenges.module';

@Module({
  imports: [AgentsModule, TasksModule, ChallengesModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
