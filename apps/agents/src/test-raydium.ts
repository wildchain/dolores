import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import {
  Connection,
  Keypair,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Raydium, Percent } from "@raydium-io/raydium-sdk-v2";
import {
  executeRaydiumTask,
  DEFAULT_POOL,
  DEFAULT_POOL_TYPE,
  VERIFIED_TOKENS,
} from "./raydium/execute-raydium";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ─── Config ───────────────────────────────────────────────────────────────────

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID = process.env.AGENT_ID!;
const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TRADE_API = "https://transaction-v1.raydium.io";
const DATA_API = "https://api-v3.raydium.io";
const RAYDIUM_CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const RAYDIUM_CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
const RAYDIUM_AMM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

if (!AGENT_ID) {
  console.error("❌ AGENT_ID required");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(agentId: string): Keypair {
  const keyPath = path.join(DOLORES_DIR, `${agentId}.json`);
  if (!fs.existsSync(keyPath)) {
    console.error(`❌ No keypair at ${keyPath}`);
    process.exit(1);
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8"))),
  );
}

function buildReceipt(params: {
  agentId: string;
  instruction: string;
  operation: string;
  txSignature: string;
  programId: string;
  keypair: Keypair;
}) {
  const receipt = {
    schema_version: "1.0",
    task_id: `raydium-${Math.floor(Date.now() / 1000)}`,
    agent_id: params.agentId,
    instruction: params.instruction,
    timestamp_unix: Math.floor(Date.now() / 1000),
    execution: {
      tx_signature: params.txSignature,
    },
    result: { status: "success", summary: `Raydium ${params.operation}` },
  };
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto
    .createHash("sha256")
    .update(canonical)
    .digest();
  const outputHash = outputHashBytes.toString("hex");
  const sig = nacl.sign.detached(outputHashBytes, params.keypair.secretKey);
  return {
    receipt,
    outputHash,
    agentSignature: Buffer.from(sig).toString("hex"),
  };
}

async function getPriorityFee(): Promise<number> {
  try {
    const res = await fetch(`${DATA_API}/main/auto-fee`);
    const data = (await res.json()) as any;
    return data?.data?.default?.h ?? 100000;
  } catch {
    return 100000;
  }
}

// ─── Swap via Trade API ───────────────────────────────────────────────────────

async function swapViaTradeApi(
  connection: Connection,
  agentKeypair: Keypair,
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
): Promise<string[]> {
  const tokenInInfo = VERIFIED_TOKENS[tokenIn];
  const tokenOutInfo = VERIFIED_TOKENS[tokenOut];
  if (!tokenInInfo || !tokenOutInfo) throw new Error(`Unknown token`);

  const amountInBase = Math.floor(
    amountIn * Math.pow(10, tokenInInfo.decimals),
  ).toString();
  const priorityFee = await getPriorityFee();

  // Step 1 — get quote
  const quoteParams = new URLSearchParams({
    inputMint: tokenInInfo.mint,
    outputMint: tokenOutInfo.mint,
    amount: amountInBase,
    slippageBps: "50",
    txVersion: "V0",
  });

  const quoteRes = await fetch(
    `${TRADE_API}/compute/swap-base-in?${quoteParams}`,
  );
  const quote = (await quoteRes.json()) as any;
  if (!quote.success) throw new Error(`Quote failed: ${quote.msg}`);

  const outDecimals = VERIFIED_TOKENS[tokenOut]?.decimals ?? 6;
  const outAmount = Number(quote.data.outputAmount) / Math.pow(10, outDecimals); // ← outputAmount not outAmount
  console.log(
    `Quote: ${amountIn} ${tokenIn} → ${outAmount.toFixed(6)} ${tokenOut}`,
  );
  console.log(`Price impact: ${quote.data.priceImpactPct}%`);

  console.log(
    `Quote: ${amountIn} ${tokenIn} → ${outAmount.toFixed(6)} ${tokenOut}`,
  );
  console.log(`Price impact: ${quote.data.priceImpactPct}%`);
  const inputMint = new PublicKey(tokenInInfo.mint);
  const inputAccount = getAssociatedTokenAddressSync(
    inputMint,
    agentKeypair.publicKey,
  ).toBase58();

  // Step 2 — build transaction
  const txRes = await fetch(`${TRADE_API}/transaction/swap-base-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      swapResponse: quote,
      wallet: agentKeypair.publicKey.toBase58(),
      txVersion: "V0",
      wrapSol: true,
      unwrapSol: true,
      inputAccount, // ← add this
      computeUnitPriceMicroLamports: priorityFee.toString(),
    }),
  });

  const txData = (await txRes.json()) as any;
  if (!txData.success) throw new Error(`TX build failed: ${txData.msg}`);

  // Step 3 — sign + send
  const signatures: string[] = [];
  for (const txInfo of txData.data) {
    const tx = VersionedTransaction.deserialize(
      Buffer.from(txInfo.transaction, "base64"),
    );
    tx.sign([agentKeypair]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(sig, "confirmed");
    signatures.push(sig);
  }

  return signatures;
}

// ─── Add / Remove liquidity via SDK ──────────────────────────────────────────

async function addLiquidityCpmm(
  agentKeypair: Keypair,
  poolId: string,
  amountIn: number,
  baseIn: boolean,
): Promise<string[]> {
  const connection = new Connection(RPC_URL, "confirmed");
  const raydium = await Raydium.load({
    connection,
    owner: agentKeypair,
    cluster: "mainnet",
    disableLoadToken: true,
  });

  const { poolInfo } = await raydium.cpmm.getPoolInfoFromRpc(poolId); // ← destructure

  const { execute } = await raydium.cpmm.addLiquidity({
    poolInfo,
    inputAmount: new BN(amountIn),
    baseIn,
    slippage: new Percent(1, 100), // ← 1/100 = 1%
    txVersion: "V0" as any,
  });

  const { txId } = await execute({ sendAndConfirm: true });
  return [txId];
}

async function removeLiquidityCpmm(
  agentKeypair: Keypair,
  poolId: string,
  lpAmount: number,
): Promise<string[]> {
  const connection = new Connection(RPC_URL, "confirmed");
  const raydium = await Raydium.load({
    connection,
    owner: agentKeypair,
    cluster: "mainnet",
    disableLoadToken: true,
  });

  const { poolInfo } = await raydium.cpmm.getPoolInfoFromRpc(poolId); // ← destructure

  const { execute } = await raydium.cpmm.withdrawLiquidity({
    poolInfo,
    lpAmount: new BN(lpAmount),
    slippage: new Percent(1, 100), // ← 1/100 = 1%
    txVersion: "V0" as any,
  });

  const { txId } = await execute({ sendAndConfirm: true });
  return [txId];
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function showStatus(poolId: string, poolType: string) {
  console.log(`\n💼 Fetching Raydium pool info...\n`);

  try {
    const res = await fetch(`${DATA_API}/pools/info/ids?ids=${poolId}`);
    const data = (await res.json()) as any;
    const pool = data?.data?.[0];

    if (!pool) {
      console.log("Pool not found");
      return;
    }

    console.log(`Pool     : ${pool.id?.slice(0, 8)}...`);
    console.log(`Type     : ${pool.type}`);
    console.log(`TVL      : $${Number(pool.tvl ?? 0).toFixed(2)}`);
    console.log(`24h Vol  : $${Number(pool.day?.volume ?? 0).toFixed(2)}`);
    console.log(`Fee APR  : ${Number(pool.day?.feeApr ?? 0).toFixed(2)}%`);
    console.log(`Price    : $${Number(pool.price ?? 0).toFixed(4)}`);
  } catch (err: any) {
    console.error("Status fetch failed:", err?.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const instruction = args.join(" ") || "help";

  console.log("\n⚡ Dolores Raydium Agent\n");
  console.log(`Agent    : ${AGENT_ID}`);
  console.log(`Command  : ${instruction}\n`);

  const agentKeypair = loadKeypair(AGENT_ID);
  const connection = new Connection(RPC_URL, "confirmed");

  if (instruction === "help") {
    console.log("Commands:");
    console.log("  status                          — show pool info");
    console.log("  'swap 0.001 SOL to USDC'        — swap via Trade API");
    console.log("  'swap 0.5 USDC to SOL'          — reverse swap");
    console.log(
      "  'add liquidity 1000000'          — add 0.001 SOL worth (CPMM)",
    );
    console.log("  'remove liquidity 500000'        — remove LP tokens (CPMM)");
    return;
  }

  if (instruction === "status") {
    await showStatus(DEFAULT_POOL, DEFAULT_POOL_TYPE);
    return;
  }

  // ── AI-parsed operations ──────────────────────────────────────────────────
  console.log("🤖 Asking Claude...");
  const decision = await executeRaydiumTask(instruction);
  console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

  if (decision.action === "reject") {
    console.log(`⚠️  Rejected: ${decision.reason}`);
    return;
  }

  if (decision.action === "status") {
    await showStatus(
      decision.poolId ?? DEFAULT_POOL,
      decision.poolType ?? DEFAULT_POOL_TYPE,
    );
    return;
  }

  const poolId = decision.poolId ?? DEFAULT_POOL;
  const poolType = decision.poolType ?? DEFAULT_POOL_TYPE;
  const programId =
    poolType === "cpmm"
      ? RAYDIUM_CPMM
      : poolType === "clmm"
        ? RAYDIUM_CLMM
        : RAYDIUM_AMM;

  let txSignatures: string[] = [];

  try {
    switch (decision.action) {
      case "swap":
        console.log(
          `⚡ Swapping ${decision.amountIn} ${decision.tokenIn} → ${decision.tokenOut}`,
        );
        txSignatures = await swapViaTradeApi(
          connection,
          agentKeypair,
          decision.tokenIn ?? "SOL",
          decision.tokenOut ?? "USDC",
          decision.amountIn ?? 0.001,
        );
        break;

      case "add_liquidity":
        console.log(`⚡ Adding liquidity: ${decision.amountIn} base units`);
        txSignatures = await addLiquidityCpmm(
          agentKeypair,
          poolId,
          decision.amountIn ?? 1000000,
          decision.baseIn ?? true,
        );
        break;

      case "remove_liquidity":
        console.log(`⚡ Removing liquidity: ${decision.lpAmount} LP tokens`);
        txSignatures = await removeLiquidityCpmm(
          agentKeypair,
          poolId,
          decision.lpAmount ?? 500000,
        );
        break;
    }
  } catch (err: any) {
    console.error(`❌ Transaction failed: ${err?.message}`);
    return;
  }

  txSignatures.forEach((sig, i) => {
    console.log(
      `\n✅ ${decision.action} confirmed! (tx ${i + 1}/${txSignatures.length})`,
    );
    console.log(`TX       : ${sig}`);
    console.log(`Explorer : https://solscan.io/tx/${sig}`);
  });

  const { outputHash, agentSignature } = buildReceipt({
    agentId: agentKeypair.publicKey.toBase58(),
    instruction,
    operation: decision.action,
    txSignatures,
    programId,
    keypair: agentKeypair,
  });

  console.log(`\n📝 Output hash : ${outputHash}`);
  console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
  console.log(`\n✅ Full loop complete!`);
  console.log(`   Claude parsed instruction       ✓`);
  console.log(`   Raydium ${decision.action} executed      ✓`);
  console.log(`   output_hash signed by agent     ✓`);

  await showStatus(poolId, poolType);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err?.message ?? err);
  process.exit(1);
});
