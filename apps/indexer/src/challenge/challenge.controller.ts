import { Controller, Get } from '@nestjs/common';
import { ChallengeEntity } from './challenge.entity';
import { ChallengeService } from './challenge.service';

@Controller('challenges')
export class ChallengeController {
  constructor(private readonly challengeService: ChallengeService) {}

  /**
   * List all challenges (read-only transparency endpoint)
   * Challenges are normally created automatically by ReviewWorker
   */
  @Get()
  async listChallenges(): Promise<ChallengeEntity[]> {
    return this.challengeService.listChallenges();
  }
}
