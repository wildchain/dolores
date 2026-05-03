import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { AuthModule } from '../../auth/auth.module';
import { AttestationService } from '../services/attestation.service';
import { AgentsModule } from '../../agents/agents.module';

@Module({
  imports: [AuthModule, AgentsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService, AttestationService],
  exports: [ChallengesService, AttestationService],
})
export class ChallengesModule {}
