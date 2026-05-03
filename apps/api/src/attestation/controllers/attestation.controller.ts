import { Controller, Get, Param, Query } from '@nestjs/common';
import { AttestationService } from '../services/attestation.service';
import { AttestationCacheData } from '../services/attestation-cache.entity';

@Controller('attestations')
export class AttestationController {
  constructor(private attestationService: AttestationService) {}

  /**
   * GET /attestations/agent/:agentId
   * Returns attestation history for an agent, newest first.
   */
  @Get('agent/:agentId')
  async getAttestationsByAgent(
    @Param('agentId') agentId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AttestationCacheData[]> {
    return this.attestationService.getAttestationsByAgent(
      agentId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
