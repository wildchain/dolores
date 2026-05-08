import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PROGRAM_IDS as PROGRAM_ID_STRINGS,
  doloresRegistryIdl,
  doloresFundIdl,
  doloresAdjudicationIdl,
  DoloresRegistryIdl,
  DoloresFundIdl,
  DoloresAdjudicationIdl,
} from "@dolores/contracts";

const PROGRAM_IDS = {
  REGISTRY: new PublicKey(PROGRAM_ID_STRINGS.REGISTRY),
  FUND: new PublicKey(PROGRAM_ID_STRINGS.FUND),
  ADJUDICATION: new PublicKey(PROGRAM_ID_STRINGS.ADJUDICATION),
};

export class DoloresPrograms {
  private connection: Connection;
  private registryProgram: Program<DoloresRegistryIdl> | null = null;
  private fundProgram: Program<DoloresFundIdl> | null = null;
  private adjudicationProgram: Program<DoloresAdjudicationIdl> | null = null;

  constructor(rpcUrl?: string) {
    const url =
      rpcUrl ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    this.connection = new Connection(url, "confirmed");
  }

  async initialize(): Promise<void> {
    const provider = new AnchorProvider(
      this.connection,
      {} as any, // read-only — no wallet needed
      AnchorProvider.defaultOptions(),
    );

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
  }

  isInitialized(): boolean {
    return !!(
      this.registryProgram &&
      this.fundProgram &&
      this.adjudicationProgram
    );
  }

  getConnection(): Connection {
    return this.connection;
  }

  getRegistryProgram(): Program<DoloresRegistryIdl> {
    if (!this.registryProgram)
      throw new Error("DoloresPrograms not initialized");
    return this.registryProgram;
  }

  getFundProgram(): Program<DoloresFundIdl> {
    if (!this.fundProgram) throw new Error("DoloresPrograms not initialized");
    return this.fundProgram;
  }

  getAdjudicationProgram(): Program<DoloresAdjudicationIdl> {
    if (!this.adjudicationProgram)
      throw new Error("DoloresPrograms not initialized");
    return this.adjudicationProgram;
  }

  // ─── PDA derivations ────────────────────────────────────────────────────────

  deriveRegistryPda(agentPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), agentPubkey.toBuffer()],
      PROGRAM_IDS.REGISTRY,
    );
  }

  deriveFundPda(
    operatorPubkey: PublicKey,
    agentPubkey: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fund"), operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
      PROGRAM_IDS.FUND,
    );
  }

  deriveTaskPda(agentPubkey: PublicKey, taskId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), agentPubkey.toBuffer(), taskId],
      PROGRAM_IDS.ADJUDICATION,
    );
  }

  deriveChallengePda(
    agentPubkey: PublicKey,
    taskId: Buffer,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("challenge"), agentPubkey.toBuffer(), taskId],
      PROGRAM_IDS.ADJUDICATION,
    );
  }

  // ─── Singleton for long-lived processes (CLI, agents) ─────────────────────

  private static _instance: DoloresPrograms | null = null;

  static async getInstance(rpcUrl?: string): Promise<DoloresPrograms> {
    if (!this._instance) {
      this._instance = new DoloresPrograms(rpcUrl);
      await this._instance.initialize();
    }
    return this._instance;
  }
}
