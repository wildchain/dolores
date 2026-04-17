import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import * as fs from 'fs';

@Controller('agents')
export class AgentController {
    private program: Program | null = null;

    constructor() {
        this.init();
    }

    private init() {
        try {
            const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
            const idlPath = process.env.DOLORES_IDL_PATH;

            if (!idlPath || !fs.existsSync(idlPath)) return;

            const connection = new Connection(rpcUrl, 'confirmed');
            const provider = new AnchorProvider(connection, {} as any, {});
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

            this.program = new Program(idl, provider);
        } catch (err) {
            console.error('AgentController: failed to init Solana client', err);
        }
    }

    @Get(':agentId')
    async getAgent(@Param('agentId') agentId: string) {
        if (!this.program) {
            throw new HttpException(
                'Solana client not initialized — check DOLORES_IDL_PATH env var',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        let agentPubkey: PublicKey;
        try {
            agentPubkey = new PublicKey(agentId);
        } catch {
            throw new HttpException(`Invalid agent pubkey: ${agentId}`, HttpStatus.BAD_REQUEST);
        }

        // Derive registry PDA — seeds: ["registry", agent.pubkey]
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), agentPubkey.toBuffer()],
            this.program.programId,
        );

        try {
            const account = await (this.program.account as any).registryAccount.fetch(registryPda);

            return {
                agentId: agentId,
                operator: account.operator.toBase58(),
                registryPda: registryPda.toBase58(),
                reputationScore: account.reputationScore,
                slashCount: account.slashCount,
                declaredStake: account.declaredStake.toString(),
                arweaveCid: account.arweaveCid || null,
                registeredAt: new Date(account.registeredAt * 1000).toISOString(),
                lastAttestedAt: account.lastAttestedAt > 0
                    ? new Date(account.lastAttestedAt * 1000).toISOString()
                    : null,
            };
        } catch (err: any) {
            if (err?.message?.includes('Account does not exist')) {
                throw new HttpException(
                    `Agent ${agentId} not registered on-chain`,
                    HttpStatus.NOT_FOUND,
                );
            }
            throw new HttpException(
                `Failed to fetch agent: ${err?.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}