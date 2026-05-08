import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { DoloresPrograms } from '@dolores/solana-utils';
import {
  DoloresRegistryIdl,
  DoloresFundIdl,
  DoloresAdjudicationIdl,
} from '@dolores/contracts';

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private programs: DoloresPrograms;

  async onModuleInit() {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.programs = new DoloresPrograms(rpcUrl);
    await this.programs.initialize();
    this.logger.log('Solana service initialized successfully');
    this.logger.log(`Connected to: ${rpcUrl}`);
  }

  getIsInitialized(): boolean {
    return this.programs?.isInitialized() ?? false;
  }

  getConnection(): Connection {
    return this.programs.getConnection();
  }

  getRegistryProgram(): Program<DoloresRegistryIdl> {
    return this.programs.getRegistryProgram();
  }

  getFundProgram(): Program<DoloresFundIdl> {
    return this.programs.getFundProgram();
  }

  getAdjudicationProgram(): Program<DoloresAdjudicationIdl> {
    return this.programs.getAdjudicationProgram();
  }

  deriveRegistryPda(agentPubkey: PublicKey): [PublicKey, number] {
    return this.programs.deriveRegistryPda(agentPubkey);
  }

  deriveFundPda(
    operatorPubkey: PublicKey,
    agentPubkey: PublicKey,
  ): [PublicKey, number] {
    return this.programs.deriveFundPda(operatorPubkey, agentPubkey);
  }

  deriveTaskPda(agentPubkey: PublicKey, taskId: Buffer): [PublicKey, number] {
    return this.programs.deriveTaskPda(agentPubkey, taskId);
  }

  deriveChallengePda(
    agentPubkey: PublicKey,
    taskId: Buffer,
  ): [PublicKey, number] {
    return this.programs.deriveChallengePda(agentPubkey, taskId);
  }
}
