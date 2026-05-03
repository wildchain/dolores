import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  executePumpFunTask,
  PUMP_PROGRAM_ID,
  PUMP_FEES_ID,
} from "./pumpfun/execute-pumpfun";

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID = process.env.AGENT_ID!;
const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const PUMP_PROGRAM = new PublicKey(PUMP_PROGRAM_ID);
const PUMP_FEES = new PublicKey(PUMP_FEES_ID);
const EVENT_AUTHORITY = new PublicKey(
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",
);
const GLOBAL_VOLUME_ACC = new PublicKey(
  "Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y",
);

if (!AGENT_ID) {
  console.error("AGENT_ID required");
  process.exit(1);
}

function loadKeypair(id: string): Keypair {
  const p = path.join(DOLORES_DIR, `${id}.json`);
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))),
  );
}

function buildReceipt(p: {
  agentId: string;
  instruction: string;
  operation: string;
  mint: string;
  txSignature: string;
  keypair: Keypair;
}) {
  const receipt = {
    schema_version: "1.0",
    task_id: `pumpfun-${Math.floor(Date.now() / 1000)}`,
    agent_id: p.agentId,
    instruction: p.instruction,
    timestamp_unix: Math.floor(Date.now() / 1000),
    execution: {
      tx_signature: p.txSignature,
      token_mint: p.mint,
    },
    result: {
      status: "success",
      summary: `PumpFun ${p.operation} on ${p.mint.slice(0, 8)}...`,
    },
  };
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto
    .createHash("sha256")
    .update(canonical)
    .digest();
  const outputHash = outputHashBytes.toString("hex");
  const sig = nacl.sign.detached(outputHashBytes, p.keypair.secretKey);
  return {
    receipt,
    outputHash,
    agentSignature: Buffer.from(sig).toString("hex"),
  };
}

function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM,
  );
  return pda;
}
function getBondingCurveV2PDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
    PUMP_PROGRAM,
  );
  return pda;
}
function getGlobalPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM,
  );
  return pda;
}
function getCreatorVaultPDA(creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM,
  );
  return pda;
}
function getUserVolumeAccPDA(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_PROGRAM,
  );
  return pda;
}
function getFeeConfigPDA(): PublicKey {
  const key = Buffer.from([
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81,
    137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
  ]);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), key],
    PUMP_FEES,
  );
  return pda;
}
async function getTokenProgram(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error("Mint not found");
  const T22 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  return info.owner.equals(T22) ? T22 : TOKEN_PROGRAM_ID;
}
function getAssocBCurve(mint: PublicKey, tokenProgram: PublicKey): PublicKey {
  if (tokenProgram.equals(TOKEN_PROGRAM_ID)) {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("associated-bonding-curve"), mint.toBuffer()],
      PUMP_PROGRAM,
    );
    return pda;
  }
  return getAssociatedTokenAddressSync(
    mint,
    getBondingCurvePDA(mint),
    true,
    tokenProgram,
  );
}

interface BCState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: PublicKey;
  cashbackEnabled: boolean;
}

function parseBC(data: Buffer): BCState {
  let o = 8;
  const vtr = data.readBigUInt64LE(o);
  o += 8;
  const vsr = data.readBigUInt64LE(o);
  o += 8;
  const rtr = data.readBigUInt64LE(o);
  o += 8;
  const rsr = data.readBigUInt64LE(o);
  o += 8;
  const tts = data.readBigUInt64LE(o);
  o += 8;
  const complete = data.readUInt8(o) === 1;
  o += 1;
  const creator = new PublicKey(data.slice(o, o + 32));
  o += 32;
  // byte[81] reserved, byte[82] = cashback_enabled
  const cashbackEnabled = data.length > 82 && data[82] !== 0;
  return {
    virtualTokenReserves: vtr,
    virtualSolReserves: vsr,
    realTokenReserves: rtr,
    realSolReserves: rsr,
    tokenTotalSupply: tts,
    complete,
    creator,
    cashbackEnabled,
  };
}

function calcBuyTokens(s: BCState, solIn: bigint): bigint {
  const fee = 100n;
  const net = (solIn * 10000n) / (10000n + fee);
  const t = (net * s.virtualTokenReserves) / (s.virtualSolReserves + net);
  return t > s.realTokenReserves ? s.realTokenReserves : t;
}
function calcSellSol(s: BCState, tokensIn: bigint): bigint {
  const fee = 100n;
  const gross =
    (tokensIn * s.virtualSolReserves) / (s.virtualTokenReserves + tokensIn);
  const net = (gross * (10000n - fee)) / 10000n;
  return net > s.realSolReserves ? s.realSolReserves : net;
}

async function getFeeRecipient(connection: Connection): Promise<PublicKey> {
  try {
    const info = await connection.getAccountInfo(getGlobalPDA());
    if (!info) throw new Error();
    return new PublicKey(info.data.slice(41, 73));
  } catch {
    return new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
  }
}

async function showStatus(connection: Connection, mintAddress: string) {
  console.log(`\n🎯 Fetching PumpFun bonding curve...\n`);
  const mint = new PublicKey(mintAddress);
  const info = await connection.getAccountInfo(getBondingCurvePDA(mint));
  if (!info) {
    console.log("Bonding curve not found.");
    return;
  }
  const s = parseBC(info.data);
  const price =
    s.virtualTokenReserves > 0n
      ? Number(s.virtualSolReserves) / Number(s.virtualTokenReserves)
      : 0;
  const mcap =
    s.virtualTokenReserves > 0n
      ? (Number(s.virtualSolReserves) * 1e9) /
        Number(s.virtualTokenReserves) /
        1e9
      : 0;
  const prog =
    (1 - Number(s.realTokenReserves) / Number(s.tokenTotalSupply)) * 100;
  console.log(`Mint           : ${mintAddress.slice(0, 8)}...`);
  console.log(`Price          : ${(price * 1e9).toFixed(10)} SOL/token`);
  console.log(`Market cap     : ~${mcap.toFixed(2)} SOL`);
  console.log(
    `Graduation     : ${prog.toFixed(1)}% (${s.complete ? "✅ COMPLETE" : "🔄 in progress"})`,
  );
  console.log(
    `Real SOL       : ${(Number(s.realSolReserves) / 1e9).toFixed(4)} SOL`,
  );
  console.log(
    `Tokens left    : ${(Number(s.realTokenReserves) / 1e6).toFixed(0)}`,
  );
  console.log(`Creator        : ${s.creator.toString().slice(0, 8)}...`);
  console.log(
    `Cashback       : ${s.cashbackEnabled ? "✅ enabled" : "❌ disabled"}`,
  );
  if (s.complete)
    console.log(`\n⚠️  Bonding curve complete — trade on PumpSwap instead`);
}

async function buyTokens(
  connection: Connection,
  kp: Keypair,
  mintAddress: string,
  solAmount: number,
  slippageBps: number,
): Promise<string> {
  const mint = new PublicKey(mintAddress);
  const bcPDA = getBondingCurvePDA(mint);
  const bcV2 = getBondingCurveV2PDA(mint);
  const global = getGlobalPDA();
  const feeConfig = getFeeConfigPDA();
  const feeRecipient = await getFeeRecipient(connection);
  const tokenProgram = await getTokenProgram(connection, mint);
  const assocBC = getAssocBCurve(mint, tokenProgram);
  const userVolAcc = getUserVolumeAccPDA(kp.publicKey);

  const info = await connection.getAccountInfo(bcPDA);
  if (!info) throw new Error("Bonding curve not found");
  const state = parseBC(info.data);
  if (state.complete)
    throw new Error("Bonding curve complete — use PumpSwap instead");

  const creatorVault = getCreatorVaultPDA(state.creator);
  const solIn = BigInt(Math.floor(solAmount * 1e9));
  const expectedOut = calcBuyTokens(state, solIn);
  const minOut = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

  console.log(
    `  Token program  : ${tokenProgram.equals(TOKEN_PROGRAM_ID) ? "SPL" : "Token2022"}`,
  );
  console.log(`  Cashback       : ${state.cashbackEnabled}`);
  console.log(`  Expected tokens: ${expectedOut.toString()}`);
  console.log(`  Min tokens out : ${minOut.toString()}`);

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  );

  const userAta = getAssociatedTokenAddressSync(
    mint,
    kp.publicKey,
    false,
    tokenProgram,
  );
  if (!(await connection.getAccountInfo(userAta))) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        kp.publicKey,
        userAta,
        kp.publicKey,
        mint,
        tokenProgram,
      ),
    );
  }

  // buy_exact_sol_in discriminator (post Feb 2026 upgrade)
  const disc = Buffer.from([56, 252, 116, 8, 158, 223, 205, 95]);
  const data = Buffer.alloc(24);
  disc.copy(data, 0);
  data.writeBigUInt64LE(solIn, 8); // sol_amount_in
  data.writeBigUInt64LE(minOut, 16); // min_tokens_out

  // 17 accounts — same for ALL tokens after Feb 2026
  tx.add(
    new TransactionInstruction({
      programId: PUMP_PROGRAM,
      keys: [
        { pubkey: global, isSigner: false, isWritable: false }, // 0
        { pubkey: feeRecipient, isSigner: false, isWritable: true }, // 1
        { pubkey: mint, isSigner: false, isWritable: false }, // 2
        { pubkey: bcPDA, isSigner: false, isWritable: true }, // 3
        { pubkey: assocBC, isSigner: false, isWritable: true }, // 4
        { pubkey: userAta, isSigner: false, isWritable: true }, // 5
        { pubkey: kp.publicKey, isSigner: true, isWritable: true }, // 6
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7
        { pubkey: tokenProgram, isSigner: false, isWritable: false }, // 8
        { pubkey: creatorVault, isSigner: false, isWritable: true }, // 9
        { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false }, // 10
        { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false }, // 11
        { pubkey: GLOBAL_VOLUME_ACC, isSigner: false, isWritable: false }, // 12 (read-only)
        { pubkey: userVolAcc, isSigner: false, isWritable: true }, // 13
        { pubkey: feeConfig, isSigner: false, isWritable: false }, // 14
        { pubkey: PUMP_FEES, isSigner: false, isWritable: false }, // 15
        { pubkey: bcV2, isSigner: false, isWritable: false }, // 16 ← always last
      ],
      data,
    }),
  );

  return sendAndConfirmTransaction(connection, tx, [kp], {
    commitment: "confirmed",
  });
}

async function sellTokens(
  connection: Connection,
  kp: Keypair,
  mintAddress: string,
  tokenAmount: number,
  slippageBps: number,
): Promise<string> {
  const mint = new PublicKey(mintAddress);
  const bcPDA = getBondingCurvePDA(mint);
  const bcV2 = getBondingCurveV2PDA(mint);
  const global = getGlobalPDA();
  const feeConfig = getFeeConfigPDA();
  const feeRecipient = await getFeeRecipient(connection);
  const tokenProgram = await getTokenProgram(connection, mint);
  const assocBC = getAssocBCurve(mint, tokenProgram);

  const info = await connection.getAccountInfo(bcPDA);
  if (!info) throw new Error("Bonding curve not found");
  const state = parseBC(info.data);
  if (state.complete)
    throw new Error("Bonding curve complete — use PumpSwap instead");

  const creatorVault = getCreatorVaultPDA(state.creator);
  const userAta = getAssociatedTokenAddressSync(
    mint,
    kp.publicKey,
    false,
    tokenProgram,
  );
  const tokensIn = BigInt(tokenAmount);
  const expectedSol = calcSellSol(state, tokensIn);
  const minSolOut = expectedSol - (expectedSol * BigInt(slippageBps)) / 10000n;

  console.log(`  Cashback       : ${state.cashbackEnabled}`);
  console.log(`  Expected SOL   : ${Number(expectedSol) / 1e9} SOL`);
  console.log(`  Min SOL out    : ${Number(minSolOut) / 1e9} SOL`);

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  );

  const disc = Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]);
  const data = Buffer.alloc(24);
  disc.copy(data, 0);
  data.writeBigUInt64LE(tokensIn, 8);
  data.writeBigUInt64LE(minSolOut, 16);

  // Base 14 accounts
  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [
      { pubkey: global, isSigner: false, isWritable: false }, // 0
      { pubkey: feeRecipient, isSigner: false, isWritable: true }, // 1
      { pubkey: mint, isSigner: false, isWritable: false }, // 2
      { pubkey: bcPDA, isSigner: false, isWritable: true }, // 3
      { pubkey: assocBC, isSigner: false, isWritable: true }, // 4
      { pubkey: userAta, isSigner: false, isWritable: true }, // 5
      { pubkey: kp.publicKey, isSigner: true, isWritable: true }, // 6
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7
      { pubkey: creatorVault, isSigner: false, isWritable: true }, // 8
      { pubkey: tokenProgram, isSigner: false, isWritable: false }, // 9
      { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false }, // 10
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false }, // 11
      { pubkey: feeConfig, isSigner: false, isWritable: false }, // 12
      { pubkey: PUMP_FEES, isSigner: false, isWritable: false }, // 13
    ];
  // Cashback tokens: user_volume_accumulator before bonding_curve_v2
  if (state.cashbackEnabled) {
    keys.push({
      pubkey: getUserVolumeAccPDA(kp.publicKey),
      isSigner: false,
      isWritable: true,
    }); // 14
  }
  // bonding_curve_v2 ALWAYS last
  keys.push({ pubkey: bcV2, isSigner: false, isWritable: false }); // 14 or 15

  tx.add(new TransactionInstruction({ programId: PUMP_PROGRAM, keys, data }));
  return sendAndConfirmTransaction(connection, tx, [kp], {
    commitment: "confirmed",
  });
}

async function main() {
  const instruction = process.argv.slice(2).join(" ") || "help";
  console.log("\n🚀 Dolores PumpFun Agent\n");
  console.log(`Agent    : ${AGENT_ID}`);
  console.log(`Command  : ${instruction}\n`);

  const kp = loadKeypair(AGENT_ID);
  const connection = new Connection(RPC_URL, "confirmed");

  if (instruction === "help") {
    console.log("  'check <MINT>'                  — status");
    console.log("  'buy 0.001 SOL of <MINT>'       — buy");
    console.log("  'sell 1000000 tokens of <MINT>' — sell");
    return;
  }

  console.log("🤖 Asking Claude...");
  const decision = await executePumpFunTask(instruction);
  console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

  if (decision.action === "reject") {
    console.log(`⚠️  Rejected: ${decision.reason}`);
    return;
  }
  if (!decision.mint) {
    console.log("❌ No mint address provided");
    return;
  }
  if (decision.action === "status") {
    await showStatus(connection, decision.mint);
    return;
  }

  let txSignature: string;
  try {
    if (decision.action === "buy") {
      console.log(`⚡ Buying on PumpFun bonding curve`);
      console.log(`  Mint : ${decision.mint.slice(0, 8)}...`);
      console.log(`  SOL  : ${decision.solAmount}`);
      txSignature = await buyTokens(
        connection,
        kp,
        decision.mint,
        decision.solAmount ?? 0.001,
        decision.slippageBps ?? 500,
      );
    } else {
      console.log(`⚡ Selling on PumpFun bonding curve`);
      console.log(`  Mint   : ${decision.mint.slice(0, 8)}...`);
      console.log(`  Tokens : ${decision.tokenAmount}`);
      txSignature = await sellTokens(
        connection,
        kp,
        decision.mint,
        decision.tokenAmount ?? 0,
        decision.slippageBps ?? 500,
      );
    }
  } catch (err: any) {
    console.error(`❌ Transaction failed: ${err?.message}`);
    return;
  }

  console.log(`\n✅ ${decision.action} confirmed!`);
  console.log(`TX       : ${txSignature}`);
  console.log(`Explorer : https://solscan.io/tx/${txSignature}`);

  const { outputHash, agentSignature } = buildReceipt({
    agentId: kp.publicKey.toBase58(),
    instruction,
    operation: decision.action,
    mint: decision.mint,
    txSignature,
    keypair: kp,
  });
  console.log(`\n📝 Output hash : ${outputHash}`);
  console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
  console.log(`\n✅ Full loop complete!`);
  console.log(`   Claude parsed instruction       ✓`);
  console.log(`   PumpFun ${decision.action} executed        ✓`);
  console.log(`   output_hash signed by agent     ✓`);

  await showStatus(connection, decision.mint);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err?.message ?? err);
  process.exit(1);
});
