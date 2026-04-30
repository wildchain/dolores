import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import idlFund from "../idl/dolores_fund.json";

const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";
const FUND_SEED = Buffer.from("fund");
const VAULT_SEED = Buffer.from("vault");

function loadKeypairFromFile(filePath: string): Keypair {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export async function depositRewardsCommand(opts: {
    agentId: string;
    operatorId: string;
    amountSol: number;
    payerKeyPath: string;
    rpcUrl: string;
}) {
    console.log("\n💸 Dolores — Deposit Rewards (Hire Fee)\n");

    const payerKeypair = loadKeypairFromFile(opts.payerKeyPath);
    const agentPubkey = new PublicKey(opts.agentId);
    const operatorPubkey = new PublicKey(opts.operatorId);
    const amountLamports = Math.floor(opts.amountSol * LAMPORTS_PER_SOL);

    console.log(`Payer           : ${payerKeypair.publicKey.toBase58()}`);
    console.log(`Agent           : ${opts.agentId}`);
    console.log(`Amount          : ${opts.amountSol} SOL\n`);

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

    const wallet = new Wallet(payerKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const fundProgram = new Program(idlFund as any, provider) as any;

    console.log(`Depositing ${opts.amountSol} SOL as hire fee into rewards pool...`);
    try {
        const tx = await fundProgram.methods
            .depositRewards(new BN(amountLamports))
            .accounts({
                depositor: payerKeypair.publicKey,
                fund: fundPda,
                vault: vaultPda,
                systemProgram: "11111111111111111111111111111111",
            })
            .rpc();

        console.log(`✅ Rewards deposited!`);
        console.log(`Transaction     : ${tx}`);
        console.log(`Explorer        : https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        const fund = await fundProgram.account.fundAccount.fetch(fundPda);
        console.log(`Accumulated rewards: ${(Number(fund.accumulatedRewards) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    } catch (err: any) {
        console.error(`\n❌ Deposit failed: ${err?.message ?? err}`);
        process.exit(1);
    }
}