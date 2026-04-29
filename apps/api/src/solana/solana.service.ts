import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  PROGRAM_IDS as PROGRAM_ID_STRINGS,
  doloresRegistryIdl,
  doloresFundIdl,
  doloresAdjudicationIdl,
  DoloresRegistryIdl,
  DoloresFundIdl,
  DoloresAdjudicationIdl,
} from '@dolores/contracts';

// Convert string IDs to PublicKey instances
const PROGRAM_IDS = {
  REGISTRY: new PublicKey(PROGRAM_ID_STRINGS.REGISTRY),
  FUND: new PublicKey(PROGRAM_ID_STRINGS.FUND),
  ADJUDICATION: new PublicKey(PROGRAM_ID_STRINGS.ADJUDICATION),
};

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private registryProgram: Program<DoloresRegistryIdl> | null = null;
  private fundProgram: Program<DoloresFundIdl> | null = null;
  private adjudicationProgram: Program<DoloresAdjudicationIdl> | null = null;

  async onModuleInit() {
    await this.initialize();
  }

  getIsInitialized(): boolean {
    return !!(
      this.connection &&
      this.registryProgram &&
      this.fundProgram &&
      this.adjudicationProgram
    );
  }

  private async initialize() {
    try {
      const rpcUrl =
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      this.connection = new Connection(rpcUrl, 'confirmed');

      // Create a read-only provider without a wallet
      const provider = new AnchorProvider(
        this.connection,
        {} as any, // No wallet needed for read-only operations
        AnchorProvider.defaultOptions(),
      );

      // Initialize programs
      this.registryProgram = new Program(
        doloresRegistryIdl as any,
        provider,
      ) as Program<DoloresRegistryIdl>;

      this.fundProgram = new Program(
        doloresFundIdl as any,
        provider,
      ) as Program<DoloresFundIdl>;

      this.adjudicationProgram = new Program(
        doloresAdjudicationIdl as any,
        provider,
      ) as Program<DoloresAdjudicationIdl>;

      this.logger.log('Solana service initialized successfully');
      this.logger.log(`Connected to: ${rpcUrl}`);
      this.logger.log(`Registry Program: ${PROGRAM_IDS.REGISTRY.toBase58()}`);
      this.logger.log(`Fund Program: ${PROGRAM_IDS.FUND.toBase58()}`);
      this.logger.log(
        `Adjudication Program: ${PROGRAM_IDS.ADJUDICATION.toBase58()}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Solana service', error);
      throw error;
    }
  }

  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    return this.connection;
  }

  getRegistryProgram(): Program<DoloresRegistryIdl> {
    if (!this.registryProgram) {
      throw new Error('Registry program not initialized');
    }
    return this.registryProgram;
  }

  getFundProgram(): Program<DoloresFundIdl> {
    if (!this.fundProgram) {
      throw new Error('Fund program not initialized');
    }
    return this.fundProgram;
  }

  getAdjudicationProgram(): Program<DoloresAdjudicationIdl> {
    if (!this.adjudicationProgram) {
      throw new Error('Adjudication program not initialized');
    }
    return this.adjudicationProgram;
  }

  /**
   * Derive Registry PDA for an agent
   */
  deriveRegistryPda(agentPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), agentPubkey.toBuffer()],
      PROGRAM_IDS.REGISTRY,
    );
  }

  /**
   * Derive Fund PDA for an agent
   */
  deriveFundPda(
    operatorPubkey: PublicKey,
    agentPubkey: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('fund'), operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
      PROGRAM_IDS.FUND,
    );
  }

  /**
   * Derive Task PDA
   */
  deriveTaskPda(agentPubkey: PublicKey, taskId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('task'), agentPubkey.toBuffer(), taskId],
      PROGRAM_IDS.ADJUDICATION,
    );
  }

  /**
   * Derive Challenge PDA
   */
  deriveChallengePda(
    agentPubkey: PublicKey,
    taskId: Buffer,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('challenge'), agentPubkey.toBuffer(), taskId],
      PROGRAM_IDS.ADJUDICATION,
    );
  }
}
