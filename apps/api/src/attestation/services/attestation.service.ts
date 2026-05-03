import { Injectable, Logger } from '@nestjs/common';
import { AgentsService } from '../../agents/agents.service';

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);

  constructor(private agentsService: AgentsService) {}

  async handleAttestationSubmitted(event: any) {
    const agentId: string = event.agent?.toBase58();
    this.logger.log(
      `AttestationSubmitted: agent=${agentId} score=${event.score} newReputation=${event.newReputation} attestedAt=${event.attestedAt}`,
    );
    try {
      await this.agentsService.updateAgentCacheFields(agentId, {
        reputationScore: event.newReputation,
        lastAttestedAt: event.attestedAt
          ? Number(event.attestedAt)
          : Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error(
        'Failed to update agent reputation from attestation',
        error,
      );
    }
  }

  async handleAgentVerified(event: any) {
    const agentId: string = event.agent?.toBase58();
    this.logger.log(
      `AgentVerified: agent=${agentId} caller=${event.caller?.toBase58()} trusted=${event.trusted}`,
    );
    // VerifyResult lives in its own on-chain PDA — no corresponding cache field yet.
    // Log only; extend when a verify-result cache is added.
  }

  async handleArweaveCidUpdated(event: any) {
    const agentId: string = event.agent?.toBase58();
    this.logger.log(`ArweaveCidUpdated: agent=${agentId} cid=${event.cid}`);
    try {
      await this.agentsService.updateAgentCacheFields(agentId, {
        arweaveCid: event.cid,
        // Clear stale manifest fields so next getAgentDetails re-fetches from IPFS
        name: undefined,
        description: undefined,
      });
    } catch (error) {
      this.logger.error('Failed to update agent arweave CID in cache', error);
    }
  }
}
