import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChallengeEntity } from './challenge.entity';
import { ChallengeService } from './challenge.service';
import type { CreateChallengeDto } from './challenge.service';

@Controller('challenges')
export class ChallengeController {
  constructor(private readonly challengeService: ChallengeService) {}

  @Post()
  async submitChallenge(
    @Body() dto: CreateChallengeDto,
  ): Promise<ChallengeEntity> {
    return this.challengeService.submitChallenge(dto);
  }

  @Get()
  async listChallenges(): Promise<ChallengeEntity[]> {
    return this.challengeService.listChallenges();
  }
}
