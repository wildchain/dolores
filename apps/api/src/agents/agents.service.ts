import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SolanaService } from '../solana/solana.service';
import { RocksDBService } from '@dolores/database';
import {
  AgentListItemDto,
  AgentDetailsDto,
  TrustBadge,
  AgentTaskDto,
} from '@dolores/shared';
import { AgentCacheEntity, AgentCacheData } from './agent-cache.entity';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

import axios from 'axios';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private solanaService: SolanaService,
    private rocksdb: RocksDBService,
  ) { }

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
        stakeAmount: fundAccount?.totalLockedStake?.toNumber() || 0,
        // Registry account fields
        capabilityHash: Array.from(registryAccount.capabilityHash || []),
        reputationScore: registryAccount.reputationScore || 0, // trust score 0–1000
        slashCount: registryAccount.slashCount || 0,
        arweaveCid: arweaveCid,
        declaredStake: registryAccount.declaredStake?.toNumber() || 0,
        lastAttestedAt: registryAccount.lastAttestedAt?.toNumber() || 0,
        // Trust score components
        weightedScoreSum: registryAccount.weightedScoreSum?.toNumber?.() ?? registryAccount.weightedScoreSum ?? 0,
        weightedTaskSum: registryAccount.weightedTaskSum?.toNumber?.() ?? registryAccount.weightedTaskSum ?? 0,
        totalTaskCount: registryAccount.totalTaskCount?.toNumber?.() ?? registryAccount.totalTaskCount ?? 0,
        challengeSurvivalCount: registryAccount.challengeSurvivalCount || 0,
        validatorAlignmentPoints: registryAccount.validatorAlignmentPoints || 0,
        // Trust metrics
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        disputedTasks: 0,
        totalResponseTime: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        availableForHire: false,
        hireFeeSOL: 0.01,
        totalEarnedSOL: 0,
        communityStake: 0,
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

  async getMarketplace(limit = 20, offset = 0): Promise<AgentListItemDto[]> {
    const keys = await this.rocksdb.keys('agent:');
    const agents: AgentCacheData[] = [];
    for (const key of keys) {
      const data = await this.rocksdb.get(key);
      if (data) {
        const agent = JSON.parse(data) as AgentCacheData;
        if (agent.availableForHire) agents.push(agent);
      }
    }
    agents.sort((a, b) => b.reputationScore - a.reputationScore);
    return agents.slice(offset, offset + limit).map((a) => this.mapToListDto(a));
  }


  async setAvailableForHire(agentId: string, available: boolean, hireFeeSOL: number): Promise<void> {
    const key = AgentCacheEntity.createKey(agentId);
    const cached = await this.rocksdb.get(key);
    if (!cached) throw new NotFoundException(`Agent ${agentId} not found`);
    const data: AgentCacheData = JSON.parse(cached);
    data.availableForHire = available;
    data.hireFeeSOL = hireFeeSOL;
    data.updatedAt = Date.now();
    await this.rocksdb.put(key, JSON.stringify(data));
    this.logger.log(`Agent ${agentId} available_for_hire=${available} fee=${hireFeeSOL} SOL`);
  }

  async buildHireTx(agentId: string, payerWallet: string, operatorId: string): Promise<{ transaction: string; message: string }> {
    const key = AgentCacheEntity.createKey(agentId);
    const cached = await this.rocksdb.get(key);
    if (!cached) throw new NotFoundException(`Agent ${agentId} not found`);
    const data: AgentCacheData = JSON.parse(cached);
    if (!data.availableForHire) throw new Error('Agent not available for hire');

    const connection = this.solanaService.getConnection();
    const agentPubkey = new PublicKey(agentId);
    const operatorPubkey = new PublicKey(operatorId);
    const payerPubkey = new PublicKey(payerWallet);
    const amountLamports = Math.floor((data.hireFeeSOL ?? 0.01) * LAMPORTS_PER_SOL);

    // Create a temporary provider with payer as wallet — needed for Anchor account resolution
    const { Keypair: SolanaKeypair } = await import('@solana/web3.js');
    const { AnchorProvider, Wallet, Program } = await import('@coral-xyz/anchor');
    const dummyKeypair = SolanaKeypair.generate();
    const dummyWallet = new Wallet(dummyKeypair);
    const tempProvider = new AnchorProvider(connection, dummyWallet, { commitment: 'confirmed' });

    const idlFund = this.solanaService.getFundProgram().idl;
    const fundProgId = this.solanaService.getFundProgram().programId;
    const tempFundProgram = new Program(idlFund as any, tempProvider) as any;

    const [fundPda] = this.solanaService.deriveFundPda(operatorPubkey, agentPubkey);
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
      fundProgId,
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const tx = await tempFundProgram.methods
      .depositRewards(new BN(amountLamports))
      .accounts({
        depositor: payerPubkey,
        fund: fundPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    tx.recentBlockhash = blockhash;
    tx.feePayer = payerPubkey;

    const serialized = tx.serialize({ requireAllSignatures: false });
    return {
      transaction: serialized.toString('base64'),
      message: `Hire agent ${agentId.slice(0, 8)}... for ${data.hireFeeSOL} SOL`,
    };
  }

  // AES-256-GCM helpers — encryption key lives only on the API server (KEYPAIR_ENCRYPTION_KEY env).
  // Users and the runtime never see or set this key.
  private getEncryptionKey(): Buffer {
    const hexKey = process.env.KEYPAIR_ENCRYPTION_KEY;
    if (!hexKey) {
      this.logger.warn('KEYPAIR_ENCRYPTION_KEY not set — using zero key (set this in production)');
    }
    return hexKey ? Buffer.from(hexKey, 'hex') : Buffer.alloc(32, 0);
  }

  private encryptSecretKey(secretKeyBytes: number[]): string {
    const keyBuf = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from(secretKeyBytes)), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
  }

  private decryptSecretKey(encrypted: string): number[] {
    const [ivHex, tagHex, ctHex] = encrypted.split(':');
    const keyBuf = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return Array.from(plain);
  }

  // Accepts raw secret key bytes from the MCP server. Encrypts server-side before storing.
  async storeKeypair(agentId: string, secretKey: number[]): Promise<void> {
    const key = AgentCacheEntity.createKey(agentId);
    const cached = await this.rocksdb.get(key);
    if (!cached) throw new NotFoundException(`Agent ${agentId} not found — run seed first`);
    const data: AgentCacheData = JSON.parse(cached);
    data.encryptedSecretKey = this.encryptSecretKey(secretKey);
    data.updatedAt = Date.now();
    await this.rocksdb.put(key, JSON.stringify(data));
    this.logger.log(`Stored keypair for agent ${agentId.slice(0, 8)}...`);
  }

  // Returns ALL agents across all operators that have stored keypairs.
  // Called only by the hosted runtime (protected by RUNTIME_SECRET check in the controller).
  async getAllAgentsForRuntime(): Promise<{ agentId: string; template: string; name: string; operator: string; secretKey: number[] }[]> {
    const keys = await this.rocksdb.keys('agent:');
    const result: { agentId: string; template: string; name: string; operator: string; secretKey: number[] }[] = [];
    for (const key of keys) {
      const raw = await this.rocksdb.get(key);
      if (!raw) continue;
      const data: AgentCacheData = JSON.parse(raw);
      if (!data.encryptedSecretKey) continue;
      result.push({
        agentId: data.agentId,
        template: data.capabilities?.[0] ?? 'SOL_TRANSFER',
        name: data.name,
        operator: data.operator,
        secretKey: this.decryptSecretKey(data.encryptedSecretKey),
      });
    }
    return result;
  }

  async seedAgent(agentId: string, data: { operator: string; name: string; template: string; description?: string }): Promise<void> {
    const key = AgentCacheEntity.createKey(agentId);

    // Check if already cached
    const existing = await this.rocksdb.get(key);
    if (existing) {
      // Update name/description only
      const parsed: AgentCacheData = JSON.parse(existing);
      parsed.name = data.name;
      parsed.description = data.description || '';
      parsed.capabilities = [data.template];
      parsed.updatedAt = Date.now();
      await this.rocksdb.put(key, JSON.stringify(parsed));
      return;
    }

    // Create minimal cache entry
    const agentData: AgentCacheData = {
      id: agentId,
      agentId,
      operator: data.operator,
      name: data.name,
      description: data.description || `${data.template} agent`,
      capabilities: [data.template],
      manifestUrl: '',
      manifest: null,
      registryPda: '',
      fundPda: '',
      registeredAt: Math.floor(Date.now() / 1000),
      fundCreatedAt: 0,
      isActive: true,
      stakeAmount: 0,
      capabilityHash: [],
      reputationScore: 0,
      slashCount: 0,
      arweaveCid: '',
      declaredStake: 0,
      lastAttestedAt: 0,
      weightedScoreSum: 0,
      weightedTaskSum: 0,
      totalTaskCount: 0,
      challengeSurvivalCount: 0,
      validatorAlignmentPoints: 0,
      availableForHire: false,
      hireFeeSOL: 0.01,
      totalEarnedSOL: 0,
      communityStake: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      disputedTasks: 0,
      totalResponseTime: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const entity = new AgentCacheEntity(agentData);
    await this.rocksdb.put(entity.getKey(), entity.toJSON());
    this.logger.log(`Seeded agent ${agentId} with name: ${data.name}`);
  }

  async refreshAgentFromSolana(agentId: string): Promise<void> {
    try {
      const agentPubkey = new PublicKey(agentId);
      const agent = await this.fetchAgentFromSolana(agentPubkey);
      if (agent) {
        await this.cacheAgent(agent);
        this.logger.log(`Refreshed agent ${agentId.slice(0, 8)}... from Solana`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to refresh agent ${agentId}: ${err?.message}`);
    }
  }
}
