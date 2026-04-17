import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    Connection,
    Keypair,
    PublicKey,
    Ed25519Program,
    Transaction,
    sendAndConfirmTransaction,
    SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReceiptEntity } from '../receipt/receipt.entity';

@Injectable()
export class AttestationService implements OnModuleInit {
    private readonly logger = new Logger(AttestationService.name);
    private program: Program | null = null;
    private watcherKeypair: Keypair | null = null;
    private connection: Connection | null = null;

    constructor() { }

    onModuleInit() {
        this.initializeSolanaClient();
    }

    //  Setup 

    private initializeSolanaClient() {
        try {
            const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
            const watcherKeyPath = process.env.WATCHER_KEYPAIR_PATH;
            const idlPath = process.env.DOLORES_IDL_PATH;

            if (!watcherKeyPath || !idlPath) {
                this.logger.warn(
                    'WATCHER_KEYPAIR_PATH or DOLORES_IDL_PATH not set — attestation disabled',
                );
                return;
            }

            if (!fs.existsSync(watcherKeyPath)) {
                this.logger.warn(`Watcher keypair not found at ${watcherKeyPath}`);
                return;
            }

            if (!fs.existsSync(idlPath)) {
                this.logger.warn(`IDL not found at ${idlPath}`);
                return;
            }

            this.watcherKeypair = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(watcherKeyPath, 'utf-8'))),
            );

            this.connection = new Connection(rpcUrl, 'confirmed');
            const wallet = new Wallet(this.watcherKeypair);
            const provider = new AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

            this.program = new Program(idl, provider);

            this.logger.log(`Attestation service ready`);
            this.logger.log(`Watcher : ${this.watcherKeypair.publicKey.toBase58()}`);
        } catch (err) {
            this.logger.error('Failed to initialize Solana client for attestation', err);
        }
    }

    //  Main entry point 

    async submitAttestation(receipt: ReceiptEntity): Promise<string | null> {
        // Load the correct agent keypair dynamically from ~/.dolores/agents/
        const agentKeypair = this.loadAgentKeypair(receipt.agentId);
        if (!agentKeypair) return null;

        if (!this.program || !this.watcherKeypair || !this.connection) {
            this.logger.warn(`Attestation skipped for ${receipt.taskId} — Solana client not initialized`);
            return null;
        }

        if (receipt.attested) {
            this.logger.debug(`Receipt ${receipt.taskId} already attested — skipping`);
            return receipt.attestationTx ?? null;
        }

        try {
            // 1. Decode output_hash from hex string to 32 bytes
            const outputHashBytes = Buffer.from(receipt.outputHash.replace('0x', ''), 'hex');
            if (outputHashBytes.length !== 32) {
                this.logger.error(
                    `Invalid outputHash for ${receipt.taskId} — expected 32 bytes, got ${outputHashBytes.length}`,
                );
                return null;
            }

            // 2. Agent signs the output_hash with its own keypair
            const agentSignature = this.signOutputHash(outputHashBytes, agentKeypair);

            // 3. Derive score and stake weight
            const score = this.deriveScore(receipt);
            const stakeWeight = 5;

            // 4. Build Ed25519 instruction — must precede submit_attestation
            const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
                publicKey: agentKeypair.publicKey.toBytes(),
                message: outputHashBytes,
                signature: agentSignature,
            });

            // 5. Derive registry PDA for this specific agent
            const [registryPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), agentKeypair.publicKey.toBuffer()],
                this.program.programId,
            );

            // 6. Build submit_attestation instruction
            const attestIx = await (this.program.methods as any)
                .submitAttestation(
                    score,
                    Array.from(outputHashBytes),
                    Array.from(agentSignature),
                    stakeWeight,
                )
                .accounts({
                    attester: this.watcherKeypair.publicKey,
                    registry: registryPda,
                    instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
                })
                .instruction();

            // 7. Send both instructions in one transaction
            const tx = new Transaction().add(ed25519Ix, attestIx);
            const sig = await sendAndConfirmTransaction(
                this.connection,
                tx,
                [this.watcherKeypair],
                { commitment: 'confirmed' },
            );

            this.logger.log(
                ` Attestation submitted — agent: ${receipt.agentId} taskId: ${receipt.taskId} score: ${score} tx: ${sig}`,
            );

            return sig;
        } catch (err: any) {
            this.logger.error(
                `Failed to submit attestation for ${receipt.taskId}: ${err?.message ?? err}`,
            );
            return null;
        }
    }

    //  Batch processing 

    async processPendingAttestations(
        receipts: ReceiptEntity[],
    ): Promise<Record<string, string | null>> {
        const results: Record<string, string | null> = {};

        for (const receipt of receipts) {
            results[receipt.taskId] = await this.submitAttestation(receipt);
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

    private signOutputHash(outputHashBytes: Buffer, agentKeypair: Keypair): Buffer {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nacl = require('tweetnacl');
        const signature = nacl.sign.detached(outputHashBytes, agentKeypair.secretKey);
        return Buffer.from(signature);
    }

    private deriveScore(receipt: ReceiptEntity): number {
        if (!receipt.cid) return 75;
        return 85;
    }
}