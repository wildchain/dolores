import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RocksDBService } from '@dolores/database';
import { AgentsService } from '../../agents/agents.service';
import { SolanaService } from '../../solana/solana.service';
import {
  AttestationCacheData,
  AttestationCacheEntity,
} from './attestation-cache.entity';
import axios from 'axios';

@Injectable()
export class AttestationService implements OnModuleInit {
  private readonly logger = new Logger(AttestationService.name);
  private readonly backfillThrottleMs = 200;

  constructor(
    private agentsService: AgentsService,
    private rocksdb: RocksDBService,
    private solanaService: SolanaService,
  ) {}

  async onModuleInit() {
    // this.logger.log('AttestationService initialized');
    // try {
    //   await this.getAllAttestationsFromSolana();
    // } catch (error) {
    //   this.logger.error('Failed to fetch attestations on startup', error);
    // }
  }

  private decodeEvents(program: any, logs: string[]) {
    const events: Array<{ name: string; data: any }> = [];
    for (const log of logs) {
      if (!log.startsWith('Program data: ')) continue;
      const base64 = log.slice('Program data: '.length);
      try {
        const event = program.coder.events.decode(base64);
        if (event) events.push(event);
      } catch {
        // Ignore non-event program logs.
      }
    }
    return events;
  }

  private async buildAttestationCacheData(
    event: any,
  ): Promise<AttestationCacheData> {
    const agentId: string = event.agent?.toBase58();
    const attestedAt: number = event.attestedAt
      ? Number(event.attestedAt)
      : Math.floor(Date.now() / 1000);
    const outputHash: number[] = Array.from(event.outputHash ?? []);
    const outputHashHex = Buffer.from(outputHash).toString('hex');
    const receiptCid =
      (await this.rocksdb.get(`receipt-cid:${outputHashHex}`)) ?? undefined;

    return {
      agentId,
      score: event.score,
      outputHash,
      newReputation: event.newReputation,
      attestedAt,
      receiptCid,
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getAllAttestationsFromSolana(): Promise<void> {
    const registryProgram = this.solanaService.getRegistryProgram();
    const connection = this.solanaService.getConnection();

    let before: string | undefined;
    const signatures: string[] = [];

    while (true) {
      const page = await connection.getSignaturesForAddress(
        registryProgram.programId,
        { limit: 1000, before },
        'confirmed',
      );

      if (page.length === 0) {
        break;
      }

      signatures.push(...page.map((entry) => entry.signature));
      before = page[page.length - 1].signature;

      if (page.length === 1000) {
        await this.sleep(this.backfillThrottleMs);
      }
    }

    if (signatures.length === 0) {
      this.logger.log(
        'No registry transactions found for attestation backfill',
      );
      return;
    }

    this.logger.log(
      `Scanning ${signatures.length} registry transactions for attestation events`,
    );

    let totalCached = 0;
    const attestationsToCache: AttestationCacheData[] = [];
    const latestByAgent = new Map<
      string,
      { newReputation: number; lastAttestedAt: number }
    >();

    // Process oldest to newest so cache and reputation updates reflect event chronology.
    for (const signature of signatures.reverse()) {
      try {
        const tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        const logs = tx?.meta?.logMessages;
        if (!logs?.length) {
          continue;
        }

        const events = this.decodeEvents(registryProgram, logs);
        for (const event of events) {
          if (event.name !== 'attestationSubmitted') {
            continue;
          }

          const data = await this.buildAttestationCacheData(event.data);
          if (!data?.receiptCid) {
            continue;
          } else {
            const loadReceipt = await axios.get(
              `https://ipfs.dolores.id/get/${data.receiptCid}`,
              { timeout: 5000 },
            );
            if (loadReceipt.status !== 200) {
              this.logger.warn(
                `Failed to load receipt ${data.receiptCid} for attestation backfill`,
              );
              continue;
            }
          }
          attestationsToCache.push(data);
          totalCached += 1;
          if (data.agentId) {
            latestByAgent.set(data.agentId, {
              newReputation: data.newReputation,
              lastAttestedAt: data.attestedAt,
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process registry tx ${signature} during attestation backfill`,
          error,
        );
      } finally {
        await this.sleep(this.backfillThrottleMs);
      }
    }

    if (attestationsToCache.length > 0) {
      // await this.cacheAttestations(attestationsToCache);
    }

    const updates = [...latestByAgent.entries()].map(
      ([agentId, latestValues]) =>
        this.agentsService
          .updateAgentCacheFields(agentId, latestValues)
          .catch((error) => {
            this.logger.warn(
              `Failed to update agent cache from attestation backfill for ${agentId}`,
              error,
            );
          }),
    );

    await Promise.all(updates);

    this.logger.log(
      `Attestation backfill complete: cached ${totalCached} attestations for ${latestByAgent.size} agents`,
    );
  }

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

  private async cacheAttestations(
    attestations: AttestationCacheData[],
  ): Promise<void> {
    const operations = attestations.map((data) => {
      const entity = new AttestationCacheEntity(data);
      return {
        type: 'put' as const,
        key: entity.getKey(),
        value: data,
      };
    });

    await this.rocksdb.batch(operations);
  }

  async handleAttestationSubmitted(event: any) {
    const data = await this.buildAttestationCacheData(event);
    this.logger.log(
      `AttestationSubmitted: agent=${data.agentId} score=${data.score} newReputation=${data.newReputation} attestedAt=${data.attestedAt}`,
    );
    try {
      await Promise.all([
        this.agentsService.updateAgentCacheFields(data.agentId, {
          reputationScore: data.newReputation,
          lastAttestedAt: data.attestedAt,
        }),
        this.cacheAttestation(data),
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
