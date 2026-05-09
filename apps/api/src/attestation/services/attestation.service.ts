import { Injectable, Logger } from '@nestjs/common';
import { RocksDBService } from '@dolores/database';
import { AgentsService } from '../../agents/agents.service';
import {
  AttestationCacheData,
  AttestationCacheEntity,
} from './attestation-cache.entity';

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);

  constructor(
    private agentsService: AgentsService,
    private rocksdb: RocksDBService,
  ) {}

  async getAllAttestations(
    limit = 20,
    offset = 0,
  ): Promise<AttestationCacheData[]> {
    const keys = await this.rocksdb.keys('attestation:');
    console.log(`Found ${keys.length} total attestations in cache`);
    const paged = keys.reverse().slice(offset, offset + limit);
    const results: AttestationCacheData[] = [];
    for (const key of paged) {
      const raw = await this.rocksdb.get(key);
      if (raw) results.push(JSON.parse(raw));
    }
    return results;
  }

  async getAttestationsByAgent(
    agentId: string,
    limit = 20,
    offset = 0,
  ): Promise<AttestationCacheData[]> {
    const keys = await this.rocksdb.keys(`attestation:${agentId}:`);
    // Keys are stored in insertion order; reverse for newest-first
    const paged = keys.reverse().slice(offset, offset + limit);
    const results: AttestationCacheData[] = [];
    for (const key of paged) {
      const raw = await this.rocksdb.get(key);
      if (raw) results.push(JSON.parse(raw));
    }
    return results;
  }

  private async cacheAttestation(data: AttestationCacheData): Promise<void> {
    const entity = new AttestationCacheEntity(data);
    await this.rocksdb.put(entity.getKey(), entity.toJSON());
  }

  async handleAttestationSubmitted(event: any) {
    const agentId: string = event.agent?.toBase58();
    const attestedAt: number = event.attestedAt
      ? Number(event.attestedAt)
      : Math.floor(Date.now() / 1000);
    this.logger.log(
      `AttestationSubmitted: agent=${agentId} score=${event.score} newReputation=${event.newReputation} attestedAt=${attestedAt}`,
    );
    try {
      const outputHashBytes: number[] = Array.from(event.outputHash ?? []);
      const outputHashHex = Buffer.from(outputHashBytes).toString('hex');
      const receiptCid =
        (await this.rocksdb.get(`receipt-cid:${outputHashHex}`)) ?? undefined;

      await Promise.all([
        this.agentsService.updateAgentCacheFields(agentId, {
          reputationScore: event.newReputation,
          lastAttestedAt: attestedAt,
        }),
        this.cacheAttestation({
          agentId,
          score: event.score,
          outputHash: outputHashBytes,
          newReputation: event.newReputation,
          attestedAt,
          receiptCid,
        }),
      ]);
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
