import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import idlFund from "../idl/dolores_fund.json";

const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";
const FUND_SEED = Buffer.from("fund");
const VAULT_SEED = Buffer.from("vault");
const STAKER_SEED = Buffer.from("staker");

function loadKeypairFromFile(filePath: string): Keypair {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export async function communityStakeCommand(opts: {
    agentId: string;
    operatorId: string;
    amountSol: number;
    stakerKeyPath: string;
    rpcUrl: string;
}) {
    console.log("\n🤝 Dolores — Community Stake\n");

    const stakerKeypair = loadKeypairFromFile(opts.stakerKeyPath);
    const agentPubkey = new PublicKey(opts.agentId);
    const operatorPubkey = new PublicKey(opts.operatorId);
    const amountLamports = Math.floor(opts.amountSol * LAMPORTS_PER_SOL);

    console.log(`Staker          : ${stakerKeypair.publicKey.toBase58()}`);
    console.log(`Agent           : ${opts.agentId}`);
    console.log(`Operator        : ${opts.operatorId}`);
    console.log(`Amount          : ${opts.amountSol} SOL\n`);

    const connection = new Connection(opts.rpcUrl, "confirmed");
    const balance = await connection.getBalance(stakerKeypair.publicKey);
    console.log(`Staker balance  : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    if (balance < amountLamports + 10_000_000) {
        console.error(`\n❌ Insufficient balance.`);
        process.exit(1);
    }

    const fundProgId = new PublicKey(FUND_PROGRAM_ID);

    const [fundPda] = PublicKey.findProgramAddressSync(
        [FUND_SEED, operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
        fundProgId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, operatorPubkey.toBuffer(), agentPubkey.toBuffer()],
        fundProgId
    );
    const [stakerPositionPda] = PublicKey.findProgramAddressSync(
        [STAKER_SEED, fundPda.toBuffer(), stakerKeypair.publicKey.toBuffer()],
        fundProgId
    );

    console.log(`Fund PDA        : ${fundPda.toBase58()}`);
    console.log(`Vault PDA       : ${vaultPda.toBase58()}\n`);

    const wallet = new Wallet(stakerKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const fundProgram = new Program(idlFund as any, provider) as any;

    try {
        await fundProgram.account.fundAccount.fetch(fundPda);
    } catch {
        console.error(`❌ Fund not found for this agent/operator pair.`);
        process.exit(1);
    }

    console.log(`Staking ${opts.amountSol} SOL as community staker...`);
    try {
        const tx = await fundProgram.methods
            .communityStake(new BN(amountLamports))
            .accounts({
                staker: stakerKeypair.publicKey,
                fund: fundPda,
                vault: vaultPda,
                stakerPosition: stakerPositionPda,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();

        console.log(`✅ Community stake successful!`);
        console.log(`Transaction     : ${tx}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        const fund = await fundProgram.account.fundAccount.fetch(fundPda);
        console.log(`Total locked    : ${(Number(fund.totalLockedStake) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        console.log(`Community stake : ${(Number(fund.communityStake) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        console.log(`Staker count    : ${fund.stakerCount}`);
    } catch (err: any) {
        console.error(`\n❌ Community stake failed: ${err?.message ?? err}`);
        process.exit(1);
    }
}