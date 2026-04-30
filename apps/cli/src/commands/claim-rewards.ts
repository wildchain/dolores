import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
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

export async function claimRewardsCommand(opts: {
    agentId: string;
    operatorId: string;
    claimerKeyPath: string;
    rpcUrl: string;
}) {
    console.log("\n🏆 Dolores — Claim Rewards\n");

    const claimerKeypair = loadKeypairFromFile(opts.claimerKeyPath);
    const agentPubkey = new PublicKey(opts.agentId);
    const operatorPubkey = new PublicKey(opts.operatorId);

    console.log(`Claimer         : ${claimerKeypair.publicKey.toBase58()}`);
    console.log(`Agent           : ${opts.agentId}\n`);

    const connection = new Connection(opts.rpcUrl, "confirmed");
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
        [STAKER_SEED, fundPda.toBuffer(), claimerKeypair.publicKey.toBuffer()],
        fundProgId
    );

    const wallet = new Wallet(claimerKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const fundProgram = new Program(idlFund as any, provider) as any;

    const balanceBefore = await connection.getBalance(claimerKeypair.publicKey);

    console.log(`Claiming rewards...`);
    try {
        const tx = await fundProgram.methods
            .claimRewards()
            .accounts({
                staker: claimerKeypair.publicKey,
                fund: fundPda,
                vault: vaultPda,
                stakerPosition: stakerPositionPda,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();

        const balanceAfter = await connection.getBalance(claimerKeypair.publicKey);
        const earned = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;

        console.log(`✅ Rewards claimed!`);
        console.log(`Transaction     : ${tx}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        console.log(`Earned          : ~${earned.toFixed(6)} SOL\n`);
    } catch (err: any) {
        console.error(`\n❌ Claim failed: ${err?.message ?? err}`);
        process.exit(1);
    }
}