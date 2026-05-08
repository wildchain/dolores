import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges/challenges.controller';
import { ChallengesService } from './challenges/challenges.service';
import { AuthModule } from '../auth/auth.module';
import { AttestationService } from './services/attestation.service';
import { AttestationController } from './controllers/attestation.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AuthModule, AgentsModule],
  controllers: [ChallengesController, AttestationController],
  providers: [ChallengesService, AttestationService],
  exports: [ChallengesService, AttestationService],
})
export class ChallengesModule {}
