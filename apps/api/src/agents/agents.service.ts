import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from '../solana/solana.service';
import { RocksDBService } from '@dolores/database';
import {
  AgentListItemDto,
  AgentDetailsDto,
  TrustBadge,
  AgentTaskDto,
} from '@dolores/shared';
import { AgentCacheEntity, AgentCacheData } from './agent-cache.entity';
import axios from 'axios';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private solanaService: SolanaService,
    private rocksdb: RocksDBService,
  ) {}

  /**
   * Get paginated list of agents
   */
  async getAgents(limit = 20, offset = 0): Promise<AgentListItemDto[]> {
    try {
      // Fetch all agents directly from Solana
      const agents = await this.fetchAllAgentsFromSolana();

      // Apply pagination
      const paginatedAgents = agents
        .slice(offset, offset + limit)
        .map((agent) => this.mapToListDto(agent));

      return paginatedAgents;
    } catch (error) {
      this.logger.error('Failed to get agents list', error);
      throw error;
    }
  }

  /**
   * Get detailed agent info
   */
  async getAgentDetails(agentId: string): Promise<AgentDetailsDto> {
    try {
      const agentPubkey = new PublicKey(agentId);

      // Try cache first
      const cached = await this.getCachedAgent(agentId);
      if (cached) {
        return this.mapToDetailsDto(cached);
      }

      // Fetch from Solana
      const agent = await this.fetchAgentFromSolana(agentPubkey);
      if (!agent) {
        throw new NotFoundException(`Agent ${agentId} not found`);
      }

      // Cache and return
      await this.cacheAgent(agent);
      return this.mapToDetailsDto(agent);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get agent details for ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Get agent's tasks
   */
  async getAgentTasks(
    agentId: string,
    limit = 20,
    offset = 0,
  ): Promise<AgentTaskDto[]> {
    try {
      // TODO: Implement once Tasks module is ready
      // This will query the task cache filtered by agentId
      this.logger.warn('getAgentTasks not yet implemented');
      return [];
    } catch (error) {
      this.logger.error(`Failed to get tasks for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Fetch all agents from Solana registry contract
   */
  private async fetchAllAgentsFromSolana(): Promise<AgentCacheData[]> {
    try {
      const registryProgram = this.solanaService.getRegistryProgram();

      // Fetch all registry accounts from the contract
      const registryAccounts =
        await registryProgram.account['registryAccount'].all();
      this.logger.log(
        `Fetched ${registryAccounts.length} agents from Solana registry`,
      );

      // Fetch full details for each agent
      const agents: AgentCacheData[] = [];
      for (const accountInfo of registryAccounts) {
        try {
          // Extract agent public key from the account
          const agentPubkey = accountInfo.account.agent as PublicKey;
          const agentData = await this.fetchAgentFromSolana(agentPubkey);

          if (agentData) {
            agents.push(agentData);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch details for agent, skipping`,
            error,
          );
        }
      }

      // Sort by registration date (newest first)
      agents.sort((a, b) => b.registeredAt - a.registeredAt);

      return agents;
    } catch (error) {
      this.logger.error('Failed to fetch all agents from Solana', error);
      throw error;
    }
  }

  /**
   * Fetch agent from Solana (Registry + Fund accounts)
   */
  private async fetchAgentFromSolana(
    agentPubkey: PublicKey,
  ): Promise<AgentCacheData | null> {
    try {
      const registryProgram = this.solanaService.getRegistryProgram();
      const fundProgram = this.solanaService.getFundProgram();

      // Derive PDAs
      const [registryPda] = this.solanaService.deriveRegistryPda(agentPubkey);
      const registryAccountInfo =
        await registryProgram.account['registryAccount'].fetchNullable(
          registryPda,
        );

      if (!registryAccountInfo) {
        return null;
      }

      const registryAccount: any = registryAccountInfo;

      // Get operator from registry
      const operator = registryAccount.operator as PublicKey;

      // Derive fund PDA
      const [fundPda] = this.solanaService.deriveFundPda(operator, agentPubkey);
      const fundAccountInfo =
        await fundProgram.account['fundAccount'].fetchNullable(fundPda);

      const fundAccount: any = fundAccountInfo;

      // Fetch manifest from Arweave
      let manifest: any = null;
      const arweaveCid = registryAccount.arweaveCid || '';
      if (arweaveCid) {
        try {
          const manifestUrl = `https://arweave.net/${arweaveCid}`;
          const response = await axios.get(manifestUrl, { timeout: 5000 });
          manifest = response.data;
        } catch (error) {
          this.logger.warn(
            `Failed to fetch manifest for agent ${agentPubkey.toBase58()}`,
          );
        }
      }

      // Extract data
      const capabilities = manifest?.capabilities
        ? manifest.capabilities.map((cap: any) => cap.name)
        : [];

      const agentData: AgentCacheData = {
        id: agentPubkey.toBase58(), // Use agent pubkey as ID
        agentId: agentPubkey.toBase58(),
        operator: operator.toBase58(),
        name: manifest?.name || 'Unknown Agent',
        description: manifest?.description || '',
        capabilities,
        manifestUrl: arweaveCid ? `https://arweave.net/${arweaveCid}` : '',
        manifest,
        registryPda: registryPda.toBase58(),
        fundPda: fundPda.toBase58(),
        registeredAt: registryAccount.registeredAt?.toNumber() || 0,
        fundCreatedAt: fundAccount?.createdAt?.toNumber() || 0,
        isActive: registryAccount.isActive || false,
        stakeAmount: fundAccount?.stakeAmount?.toNumber() || 0,
        // Registry account fields
        capabilityHash: Array.from(registryAccount.capabilityHash || []),
        reputationScore: registryAccount.reputationScore || 0,
        slashCount: registryAccount.slashCount || 0,
        arweaveCid: arweaveCid,
        declaredStake: registryAccount.declaredStake?.toNumber() || 0,
        lastAttestedAt: registryAccount.lastAttestedAt?.toNumber() || 0,
        // Trust metrics
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        disputedTasks: 0,
        totalResponseTime: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return agentData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch agent from Solana: ${agentPubkey.toBase58()}`,
        error,
      );
      return null;
    }
  }

  /**
   * Cache agent data
   */
  private async cacheAgent(data: AgentCacheData): Promise<void> {
    const entity = new AgentCacheEntity(data);
    await this.rocksdb.put(entity.getKey(), entity.toJSON());
  }

  /**
   * Get cached agent
   */
  private async getCachedAgent(
    agentId: string,
  ): Promise<AgentCacheData | null> {
    const key = AgentCacheEntity.createKey(agentId);
    const cached = await this.rocksdb.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Get all cached agents
   */
  private async getAllCachedAgents(): Promise<AgentCacheData[]> {
    const keys = await this.rocksdb.keys('agent:');
    const agents: AgentCacheData[] = [];

    for (const key of keys) {
      const data = await this.rocksdb.get(key);
      if (data) {
        agents.push(JSON.parse(data));
      }
    }

    // Sort by registration date (newest first)
    agents.sort((a, b) => b.registeredAt - a.registeredAt);

    return agents;
  }

  /**
   * Map to list DTO
   */
  private mapToListDto(data: AgentCacheData): AgentListItemDto {
    const entity = new AgentCacheEntity(data);
    const trustBadge: TrustBadge = {
      totalTasks: data.totalTasks,
      completedTasks: data.completedTasks,
      successRate: entity.getSuccessRate(),
      avgResponseTime: entity.getAvgResponseTime(),
      stakeAmount: data.stakeAmount,
      ageSince: new Date(data.registeredAt * 1000).toISOString(),
    };

    return {
      agentId: data.agentId,
      operator: data.operator,
      name: data.name,
      description: data.description,
      capabilities: data.capabilities,
      trustBadge,
      isActive: data.isActive,
      stakeAmount: data.stakeAmount,
      reputationScore: data.reputationScore,
      slashCount: data.slashCount,
    };
  }

  /**
   * Map to details DTO
   */
  private mapToDetailsDto(data: AgentCacheData): AgentDetailsDto {
    const listDto = this.mapToListDto(data);

    return {
      ...listDto,
      manifestUrl: data.manifestUrl,
      manifest: data.manifest,
      registryPda: data.registryPda,
      fundPda: data.fundPda,
      registeredAt: data.registeredAt,
      fundCreatedAt: data.fundCreatedAt,
      capabilityHash: data.capabilityHash,
      reputationScore: data.reputationScore,
      slashCount: data.slashCount,
      arweaveCid: data.arweaveCid,
      declaredStake: data.declaredStake,
      lastAttestedAt: data.lastAttestedAt,
    };
  }
}
