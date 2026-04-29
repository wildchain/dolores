import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReceiptEntity } from '../receipt/receipt.entity';
import { Ed25519Program } from '@solana/web3.js';

export interface PendingSubmissionResult {
  signature: string | null;
  pendingAttestationPda: string | null;
}



@Injectable()
export class AttestationService implements OnModuleInit {
  private readonly logger = new Logger(AttestationService.name);
  private program: Program | null = null;
  private reviewerKeypair: Keypair | null = null;
  private connection: Connection | null = null;

  constructor() { }

  onModuleInit() {
    this.initializeSolanaClient();
  }

  //  Setup

  private initializeSolanaClient() {
    try {
      const rpcUrl =
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const reviewerKeyPath =
        process.env.REVIEWER_KEYPAIR_PATH || process.env.WATCHER_KEYPAIR_PATH;
      const idlPath = process.env.DOLORES_IDL_PATH;

      if (!reviewerKeyPath || !idlPath) {
        this.logger.warn(
          'REVIEWER_KEYPAIR_PATH or DOLORES_IDL_PATH not set — attestation disabled',
        );
        return;
      }

      if (!fs.existsSync(reviewerKeyPath)) {
        this.logger.warn(`Reviewer keypair not found at ${reviewerKeyPath}`);
        return;
      }

      if (!fs.existsSync(idlPath)) {
        this.logger.warn(`IDL not found at ${idlPath}`);
        return;
      }

      this.reviewerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(reviewerKeyPath, 'utf-8'))),
      );

      this.connection = new Connection(rpcUrl, 'confirmed');
      const wallet = new Wallet(this.reviewerKeypair);
      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
      });
      const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

      this.program = new Program(idl, provider);

      this.logger.log(`Attestation service ready`);
      this.logger.log(
        `Reviewer : ${this.reviewerKeypair.publicKey.toBase58()}`,
      );
    } catch (err) {
      this.logger.error(
        'Failed to initialize Solana client for attestation',
        err,
      );
    }
  }

  getReviewerPublicKey(): string {
    return this.reviewerKeypair?.publicKey.toBase58() ?? '';
  }

  async submitPendingAttestation(
    receipt: ReceiptEntity,
  ): Promise<PendingSubmissionResult> {
    if (!this.program || !this.connection || !this.reviewerKeypair) {
      this.logger.warn(
        `Submission skipped for ${receipt.taskId} — Solana client not initialized`,
      );
      return { signature: null, pendingAttestationPda: null };
    }

    if (receipt.pendingAttestationPda) {
      this.logger.debug(
        `Receipt ${receipt.taskId} already pending review — skipping`,
      );
      return {
        signature: receipt.submissionTx ?? null,
        pendingAttestationPda: receipt.pendingAttestationPda,
      };
    }

    try {
      const outputHashBytes = Buffer.from(
        receipt.outputHash.replace('0x', ''),
        'hex',
      );
      if (outputHashBytes.length !== 32) {
        this.logger.error(
          `Invalid outputHash for ${receipt.taskId} — expected 32 bytes, got ${outputHashBytes.length}`,
        );
        return { signature: null, pendingAttestationPda: null };
      }

      const agentPublicKey = new PublicKey(receipt.agentId);

      const [registryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), agentPublicKey.toBuffer()],
        this.program.programId,
      );
      const agentSignatureBytes = Buffer.from(receipt.agentSignature ?? '', 'hex');

      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: agentPublicKey.toBytes(),
        message: outputHashBytes,
        signature: agentSignatureBytes,
      });

      const submitIx = await (this.program.methods as any)
        .submitAttestation(
          85,
          Array.from(outputHashBytes),
          Array.from(agentSignatureBytes),
          1,
        )
        .accounts({
          attester: this.reviewerKeypair.publicKey,
          registry: registryPda,
        })
        .instruction();
      const tx = new Transaction().add(ed25519Ix, submitIx); // ed25519 first
      const sig = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.reviewerKeypair],
        { commitment: 'confirmed' },
      );

      this.logger.log(
        `Pending attestation submitted — agent: ${receipt.agentId} taskId: ${receipt.taskId} tx: ${sig}`,
      );

      return { signature: sig, pendingAttestationPda: null };
    } catch (err: any) {
      this.logger.error(
        `Failed to submit pending attestation for ${receipt.taskId}: ${err?.message ?? err}`,
      );
      return { signature: null, pendingAttestationPda: null };
    }
  }

  async approveAttestation(receipt: ReceiptEntity): Promise<string | null> {
    if (!this.program || !this.reviewerKeypair || !this.connection) {
      this.logger.warn(
        `Approval skipped for ${receipt.taskId} — reviewer client not initialized`,
      );
      return null;
    }

    const outputHashBytes = this.parseHash(
      receipt.outputHash,
      receipt.taskId,
      'outputHash',
    );
    if (!outputHashBytes) return null;

    const targetAgent = new PublicKey(receipt.agentId);
    const [reviewerRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), this.reviewerKeypair.publicKey.toBuffer()],
      this.program.programId,
    );
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), targetAgent.toBuffer()],
      this.program.programId,
    );
    const [pendingAttestationPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('pending_attestation'),
        targetAgent.toBuffer(),
        outputHashBytes,
      ],
      this.program.programId,
    );

    try {
      const approveIx = await (this.program.methods as any)
        .approveAttestation(Array.from(outputHashBytes))
        .accounts({
          reviewer: this.reviewerKeypair.publicKey,
          reviewerRegistry: reviewerRegistryPda,
          registry: registryPda,
          pendingAttestation: pendingAttestationPda,
        })
        .instruction();

      const tx = new Transaction().add(approveIx);
      return await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.reviewerKeypair],
        {
          commitment: 'confirmed',
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to approve attestation for ${receipt.taskId}: ${err?.message ?? err}`,
      );
      return null;
    }
  }

  async challengeAttestation(
    receipt: ReceiptEntity,
    violationHashHex: string,
    evidenceCid: string,
  ): Promise<string | null> {
    if (!this.program || !this.reviewerKeypair || !this.connection) {
      this.logger.warn(
        `Challenge skipped for ${receipt.taskId} — reviewer client not initialized`,
      );
      return null;
    }

    const outputHashBytes = this.parseHash(
      receipt.outputHash,
      receipt.taskId,
      'outputHash',
    );
    const violationHashBytes = this.parseHash(
      violationHashHex,
      receipt.taskId,
      'violationHash',
    );
    if (!outputHashBytes || !violationHashBytes) return null;

    const targetAgent = new PublicKey(receipt.agentId);
    const [reviewerRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), this.reviewerKeypair.publicKey.toBuffer()],
      this.program.programId,
    );
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), targetAgent.toBuffer()],
      this.program.programId,
    );
    const [pendingAttestationPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('pending_attestation'),
        targetAgent.toBuffer(),
        outputHashBytes,
      ],
      this.program.programId,
    );
    const [challengePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('challenge'), pendingAttestationPda.toBuffer()],
      this.program.programId,
    );

    try {
      const challengeIx = await (this.program.methods as any)
        .challengeAttestation(
          Array.from(outputHashBytes),
          Array.from(violationHashBytes),
          evidenceCid,
        )
        .accounts({
          reviewer: this.reviewerKeypair.publicKey,
          reviewerRegistry: reviewerRegistryPda,
          registry: registryPda,
          pendingAttestation: pendingAttestationPda,
          challenge: challengePda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(challengeIx);
      return await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.reviewerKeypair],
        {
          commitment: 'confirmed',
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to challenge attestation for ${receipt.taskId}: ${err?.message ?? err}`,
      );
      return null;
    }
  }

  async processPendingSubmissions(
    receipts: ReceiptEntity[],
  ): Promise<Record<string, PendingSubmissionResult>> {
    const results: Record<string, PendingSubmissionResult> = {};

    for (const receipt of receipts) {
      results[receipt.taskId] = await this.submitPendingAttestation(receipt);
      await new Promise((r) => setTimeout(r, 500));
    }

    return results;
  }

  //  Helpers

  private loadAgentKeypair(agentId: string): Keypair | null {
    const agentDir = path.join(os.homedir(), '.dolores', 'agents');
    const keyPath = path.join(agentDir, `${agentId}.json`);

    if (!fs.existsSync(keyPath)) {
      this.logger.warn(`No keypair found for agent ${agentId} at ${keyPath}`);
      return null;
    }

    try {
      return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf-8'))),
      );
    } catch (err) {
      this.logger.error(`Failed to load keypair for agent ${agentId}: ${err}`);
      return null;
    }
  }

  private parseHash(
    value: string,
    taskId: string,
    fieldName: string,
  ): Buffer | null {
    const bytes = Buffer.from(value.replace(/^0x/, ''), 'hex');
    if (bytes.length !== 32) {
      this.logger.error(
        `Invalid ${fieldName} for ${taskId} — expected 32 bytes, got ${bytes.length}`,
      );
      return null;
    }
    return bytes;
  }
}
