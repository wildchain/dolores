import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { AuthGuard } from '../../auth/auth.guard';
import {
  BuildFileChallengeDto,
  BuildAutoAdjudicateDto,
  UnsignedTransactionDto,
} from '@dolores/shared';
import { ChallengeCacheData } from './challenge-cache.entity';

@Controller('challenges')
export class ChallengesController {
  constructor(private challengesService: ChallengesService) {}

  /**
   * GET /challenges/:id - Get challenge details
   */
  @Get(':id')
  async getChallengeDetails(
    @Param('id') challengeId: string,
  ): Promise<ChallengeCacheData> {
    return this.challengesService.getChallengeDetails(challengeId);
  }

  /**
   * POST /challenges/build-file - Build unsigned transaction for filing receipt
   * Requires authentication (operator wallet)
   */
  @Post('build-file')
  @UseGuards(AuthGuard)
  async buildFileChallenge(
    @Body() dto: BuildFileChallengeDto,
    @Request() req: any,
  ): Promise<UnsignedTransactionDto> {
    const operatorWallet = req.user.wallet;
    return this.challengesService.buildFileChallenge(dto, operatorWallet);
  }

  /**
   * POST /challenges/build-auto-adjudicate - Build unsigned transaction for auto-adjudication
   * Requires authentication (requester wallet)
   */
  @Post('build-auto-adjudicate')
  @UseGuards(AuthGuard)
  async buildAutoAdjudicate(
    @Body() dto: BuildAutoAdjudicateDto,
    @Request() req: any,
  ): Promise<UnsignedTransactionDto> {
    const requesterWallet = req.user.wallet;
    return this.challengesService.buildAutoAdjudicate(dto, requesterWallet);
  }
}
