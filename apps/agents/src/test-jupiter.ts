import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import fetch from "node-fetch";
import { executeJupiterTask, VERIFIED_TOKENS } from "./jupiter/execute-jupiter";
import { fetchPrice, fetchPrices } from "./jupiter/price";
import {
  getJupiterJwt,
  createLimitOrder,
  getOrderHistory,
} from "./jupiter/limit-order";
import { getPortfolio } from "./jupiter/portfolio";
import { createDCAOrder, getDCAOrders } from "./jupiter/dca";

const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");
const AGENT_ID = process.env.AGENT_ID!;
const API_KEY = process.env.JUPITER_API_KEY!;
const BASE = "https://api.jup.ag";

if (!AGENT_ID) {
  console.error("❌ AGENT_ID required");
  process.exit(1);
}
if (!API_KEY) {
  console.error("❌ JUPITER_API_KEY required");
  process.exit(1);
}

//  Helpers

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

async function jupiterFetch<T>(path: string, init?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function executeSwap(
  agentKeypair: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number,
) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    taker: agentKeypair.publicKey.toBase58(),
  });

  const order = await jupiterFetch<{
    transaction: string | null;
    requestId: string;
    error?: string;
  }>(`/swap/v2/order?${params}`);

  if (order.error || !order.transaction) {
    throw new Error(`Order failed: ${order.error}`);
  }

  const tx = VersionedTransaction.deserialize(
    Buffer.from(order.transaction, "base64"),
  );
  tx.sign([agentKeypair]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");

  return jupiterFetch<{
    status: string;
    signature: string;
    code: number;
    inputAmountResult?: string;
    outputAmountResult?: string;
    error?: string;
  }>("/swap/v2/execute", {
    method: "POST",
    body: JSON.stringify({
      signedTransaction: signedTx,
      requestId: order.requestId,
    }),
  });
}

function buildAndSignReceipt(params: {
  agentKeypair: Keypair;
  instruction: string;
  txSignature: string;
  type: string;
  transfers: any[];
  summary: string;
}) {
  const receipt = {
    schema_version: "1.0",
    task_id: `jupiter-${Math.floor(Date.now() / 1000)}`,
    agent_id: params.agentKeypair.publicKey.toBase58(),
    instruction: params.instruction,
    timestamp_unix: Math.floor(Date.now() / 1000),
    execution: {
      tx_signature: params.txSignature,
    },
    result: { status: "success", summary: params.summary },
  };

  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  const outputHashBytes = crypto
    .createHash("sha256")
    .update(canonical)
    .digest();
  const outputHash = outputHashBytes.toString("hex");
  const signature = nacl.sign.detached(
    outputHashBytes,
    params.agentKeypair.secretKey,
  );
  const agentSignature = Buffer.from(signature).toString("hex");

  return { receipt, outputHash, agentSignature };
}

//  Main

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const instruction = args.join(" ");
  const instructionLower = instruction.toLowerCase();

  console.log("\n🚀 Dolores Jupiter Agent\n");
  console.log(`Agent    : ${AGENT_ID}`);
  console.log(`Command  : ${instruction}\n`);

  const agentKeypair = loadKeypair(AGENT_ID);

  //  Help
  if (command === "help") {
    console.log("Commands:");
    console.log(
      "  price                                    — show token prices",
    );
    console.log(
      "  portfolio                                — show wallet positions",
    );
    console.log("  swap 0.001 SOL to USDC                  — immediate swap");
    console.log("  'swap 0.001 SOL to USDC if above $80'   — conditional swap");
    console.log("  'swap 0.15 SOL to USDC when hits $200'  — limit order");
    console.log(
      "  dca hourly                               — DCA buy USDC hourly",
    );
    console.log(
      "  dca daily                                — DCA buy USDC daily",
    );
    return;
  }

  //  Price
  if (command === "price") {
    console.log("📊 Fetching prices...\n");
    const mints = [
      VERIFIED_TOKENS.SOL,
      VERIFIED_TOKENS.USDC,
      VERIFIED_TOKENS.JUP,
      VERIFIED_TOKENS.BONK,
      VERIFIED_TOKENS.WIF,
    ];
    const prices = await fetchPrices(mints);
    for (const [, price] of Object.entries(prices)) {
      if (price) {
        console.log(
          `${price.symbol.padEnd(6)} : $${price.priceUsd.toFixed(6)} (${price.confidenceLevel})`,
        );
      }
    }
    return;
  }

  //  Portfolio
  if (command === "portfolio") {
    console.log("💼 Fetching portfolio...\n");
    const portfolio = await getPortfolio(agentKeypair.publicKey.toBase58());
    console.log(`Total value : $${portfolio.totalValueUsd.toFixed(2)} USD`);
    if (portfolio.positions.length === 0) {
      console.log("No positions found (Jupiter portfolio API is beta)");
    }
    portfolio.positions.forEach(p => {
      console.log(`\n${p.platform} (${p.type}) — $${p.valueUsd.toFixed(2)}`);
      p.tokens.forEach(t =>
        console.log(`  ${t.symbol}: ${t.amount} ($${t.valueUsd.toFixed(2)})`),
      );
    });
    return;
  }

  //  DCA
  if (
    command === "dca" ||
    instructionLower.includes("every") ||
    instructionLower.includes("daily") ||
    instructionLower.includes("hourly") ||
    instructionLower.includes("recurring")
  ) {
    console.log("🔄 Setting up DCA order...\n");

    // Show active orders first
    const activeOrders = await getDCAOrders(agentKeypair.publicKey.toBase58());
    if (activeOrders.length > 0) {
      console.log(`Active DCA orders: ${activeOrders.length}`);
      activeOrders.forEach(o =>
        console.log(`  ${o.publicKey.slice(0, 8)}... — ${o.status}`),
      );
      console.log();
    }

    // Parse interval
    let intervalSeconds = 3600;
    if (instructionLower.includes("daily")) intervalSeconds = 86400;
    if (instructionLower.includes("hourly")) intervalSeconds = 3600;
    if (instructionLower.includes("minute")) intervalSeconds = 60;

    // Min viable: $100 total, 2 orders
    const solPrice = await fetchPrice(VERIFIED_TOKENS.SOL);
    const priceUsd = solPrice?.priceUsd ?? 85;
    const totalLamports = Math.floor((100 / priceUsd) * 1_000_000_000);
    const perOrder = Math.floor(totalLamports / 2);

    console.log(`SOL price    : $${priceUsd.toFixed(2)}`);
    console.log(
      `Total        : ${(totalLamports / 1e9).toFixed(4)} SOL (~$100)`,
    );
    console.log(`Per order    : ${(perOrder / 1e9).toFixed(4)} SOL (~$50)`);
    console.log(`Interval     : ${intervalSeconds}s`);
    console.log(`Orders       : 2\n`);

    try {
      const result = await createDCAOrder({
        agentKeypair,
        inputMint: VERIFIED_TOKENS.SOL,
        outputMint: VERIFIED_TOKENS.USDC,
        totalAmount: totalLamports,
        numberOfOrders: 2,
        intervalSeconds,
      });

      console.log(`✅ DCA order created!`);
      console.log(`Order key : ${result.requestId}`);
      console.log(`TX        : ${result.txSignature}`);
      console.log(`Explorer  : https://solscan.io/tx/${result.txSignature}`);

      const { outputHash, agentSignature } = buildAndSignReceipt({
        agentKeypair,
        instruction,
        txSignature: result.txSignature,
        type: "dca_order",
        transfers: [],
        summary: `DCA: buy USDC every ${intervalSeconds}s, $50 per order, 2 orders`,
      });
      console.log(`\n📝 Output hash : ${outputHash}`);
      console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
    } catch (err: any) {
      console.error(`❌ DCA failed: ${err?.message}`);
    }
    return;
  }

  //  Limit order
  if (
    instructionLower.includes("when") ||
    instructionLower.includes("hits") ||
    instructionLower.includes("limit")
  ) {
    console.log("📋 Creating limit order...\n");

    const decision = await executeJupiterTask(instruction);
    console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

    if (decision.action === "reject") {
      console.log(`⚠️  Rejected: ${decision.reason}`);
      return;
    }

    if (decision.action === "wait") {
      console.log(`⏳ ${decision.reason}`);
      console.log(
        `   Placing limit order on Jupiter — will execute when condition is met\n`,
      );

      const jwt = await getJupiterJwt(agentKeypair);
      console.log("🔐 JWT obtained");

      const minLamports = Math.floor(
        (10 / (await fetchPrice(VERIFIED_TOKENS.SOL))!.priceUsd) *
          1_000_000_000,
      );
      const orderLamports = Math.max(
        decision.targetPrice ? Math.floor(0.15 * 1_000_000_000) : minLamports,
        minLamports,
      );

      const result = await createLimitOrder({
        agentKeypair,
        jwt,
        inputMint: VERIFIED_TOKENS.SOL,
        outputMint: VERIFIED_TOKENS.USDC,
        inputAmount: orderLamports.toString(),
        triggerPriceUsd: decision.targetPrice,
        triggerCondition: decision.condition as "above" | "below",
      });

      console.log(`\n✅ Limit order placed!`);
      console.log(`Order ID : ${result.orderId}`);
      console.log(`TX       : ${result.txSignature}`);
      console.log(`Explorer : https://solscan.io/tx/${result.txSignature}`);

      const { orders } = await getOrderHistory(jwt);
      console.log(`\nActive orders: ${orders.length}`);
      orders
        .slice(0, 3)
        .forEach(o =>
          console.log(
            `  ${o.id.slice(0, 8)}... — ${o.orderState} @ $${o.triggerPriceUsd}`,
          ),
        );
      return;
    }

    // Swap action with price condition — execute immediately if condition met
    if (!decision.priceCondition) {
      console.log("No price condition — use swap command for immediate swaps");
      return;
    }

    const jwt = await getJupiterJwt(agentKeypair);
    const minLamports = Math.floor(
      (10 / (await fetchPrice(VERIFIED_TOKENS.SOL))!.priceUsd) * 1_000_000_000,
    );

    const result = await createLimitOrder({
      agentKeypair,
      jwt,
      inputMint: decision.inputMint,
      outputMint: decision.outputMint,
      inputAmount: Math.max(decision.amountLamports, minLamports).toString(),
      triggerPriceUsd: decision.priceCondition.thresholdUsd,
      triggerCondition: decision.priceCondition.operator,
    });

    console.log(`✅ Limit order placed!`);
    console.log(`Order ID : ${result.orderId}`);
    console.log(`TX       : ${result.txSignature}`);
    console.log(`Explorer : https://solscan.io/tx/${result.txSignature}`);
    return;
  }

  //  Immediate swap

  const solPrice = await fetchPrice(VERIFIED_TOKENS.SOL);
  if (solPrice) console.log(`💰 SOL price: $${solPrice.priceUsd.toFixed(2)}\n`);

  console.log("🤖 Asking Claude...");
  const decision = await executeJupiterTask(instruction);
  console.log(`Decision : ${JSON.stringify(decision, null, 2)}\n`);

  if (decision.action === "reject") {
    console.log(`⚠️  Rejected: ${decision.reason}`);
    return;
  }

  if (decision.action === "wait") {
    console.log(`⏳ ${decision.reason}`);
    return;
  }

  console.log(
    `⚡ Executing: ${decision.amountSol} ${decision.inputSymbol} → ${decision.outputSymbol}`,
  );
  const result = await executeSwap(
    agentKeypair,
    decision.inputMint,
    decision.outputMint,
    decision.amountLamports,
    decision.slippageBps,
  );

  if (result.status !== "Success") {
    throw new Error(`Swap failed (${result.code}): ${result.error}`);
  }

  console.log(`\n✅ Swap confirmed!`);
  console.log(`TX       : ${result.signature}`);
  console.log(`Explorer : https://solscan.io/tx/${result.signature}`);
  console.log(`Input    : ${result.inputAmountResult} lamports`);
  console.log(`Output   : ${result.outputAmountResult}`);

  const { outputHash, agentSignature } = buildAndSignReceipt({
    agentKeypair,
    instruction,
    txSignature: result.signature,
    type: "swap",
    transfers: [
      {
        mint: decision.inputMint,
        amount: parseInt(result.inputAmountResult ?? "0"),
        direction: "out",
        from: agentKeypair.publicKey.toBase58(),
        to: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      },
      {
        mint: decision.outputMint,
        amount: parseInt(result.outputAmountResult ?? "0"),
        direction: "in",
        from: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        to: agentKeypair.publicKey.toBase58(),
      },
    ],
    summary: `Swapped ${decision.amountSol} ${decision.inputSymbol} → ${result.outputAmountResult} ${decision.outputSymbol}`,
  });

  console.log(`\n📝 Output hash : ${outputHash}`);
  console.log(`   Agent sig   : ${agentSignature.slice(0, 16)}...`);
  console.log(`\n✅ Full loop complete!`);
  console.log(`   Claude parsed instruction       ✓`);
  console.log(`   Jupiter swap executed           ✓`);
  console.log(`   Execution receipt built         ✓`);
  console.log(`   output_hash signed by agent     ✓`);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err?.message ?? err);
  process.exit(1);
});
