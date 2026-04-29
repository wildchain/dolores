import fetch from "node-fetch";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

const BASE    = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY!;

async function jupiterFetch<T>(path: string, init?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key":    API_KEY,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter DCA ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DCAOrderParams {
  agentKeypair:    Keypair;
  inputMint:       string;
  outputMint:      string;
  totalAmount:     number;   // total lamports to spend
  numberOfOrders:  number;   // min 2
  intervalSeconds: number;   // seconds between each order
}

export interface DCAOrderResult {
  requestId:   string;
  txSignature: string;
}

export interface DCAOrder {
  publicKey:       string;
  inputMint:       string;
  outputMint:      string;
  inAmount:        string;
  inAmountPerCycle: string;
  cycleFrequency:  number;
  status:          string;
}

// ─── Create DCA order ─────────────────────────────────────────────────────────

export async function createDCAOrder(
  params: DCAOrderParams
): Promise<DCAOrderResult> {
  const { agentKeypair } = params;

  if (params.numberOfOrders < 2) {
    throw new Error("DCA requires at least 2 orders");
  }

  // 1. Create order — returns requestId + unsigned transaction
  const data = await jupiterFetch<{
    requestId:   string;
    transaction: string;
    error?:      string;
  }>("/recurring/v1/createOrder", {
    method: "POST",
    body: JSON.stringify({
      user:       agentKeypair.publicKey.toBase58(),
      inputMint:  params.inputMint,
      outputMint: params.outputMint,
      params: {
        time: {
          inAmount:       params.totalAmount,
          numberOfOrders: params.numberOfOrders,
          interval:       params.intervalSeconds,
          minPrice:       null,
          maxPrice:       null,
          startAt:        null,
        },
      },
    }),
  });

  if (data.error) throw new Error(`DCA order failed: ${data.error}`);

  // 2. Sign transaction
  const tx = VersionedTransaction.deserialize(
    Buffer.from(data.transaction, "base64")
  );
  tx.sign([agentKeypair]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");

  // 3. Execute — use requestId from createOrder response
  const result = await jupiterFetch<{
    txSignature: string;
    error?:      string;
  }>("/recurring/v1/execute", {
    method: "POST",
    body: JSON.stringify({
      signedTransaction: signedTx,
      requestId:         data.requestId,  // ← from createOrder response
    }),
  });

  if (result.error) throw new Error(`DCA execute failed: ${result.error}`);

  return {
    requestId:   data.requestId,
    txSignature: result.txSignature,
  };
}

// ─── Get active DCA orders ────────────────────────────────────────────────────

export async function getDCAOrders(
  walletAddress: string
): Promise<DCAOrder[]> {
  const data = await jupiterFetch<{ orders: DCAOrder[] }>(
    `/recurring/v1/getRecurringOrders?user=${walletAddress}&orderStatus=active&recurringType=time&includeFailedTx=false`
  );
  return data.orders ?? [];
}

// ─── Cancel DCA order ─────────────────────────────────────────────────────────

export async function cancelDCAOrder(
  agentKeypair: Keypair,
  orderPublicKey: string
): Promise<string> {
  const data = await jupiterFetch<{
    requestId:   string;
    transaction: string;
    error?:      string;
  }>("/recurring/v1/cancelOrder", {
    method: "POST",
    body: JSON.stringify({
      user:        agentKeypair.publicKey.toBase58(),
      orderPubKey: orderPublicKey,
    }),
  });

  if (data.error) throw new Error(`Cancel failed: ${data.error}`);

  const tx = VersionedTransaction.deserialize(
    Buffer.from(data.transaction, "base64")
  );
  tx.sign([agentKeypair]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");

  const result = await jupiterFetch<{ txSignature: string }>(
    "/recurring/v1/execute",
    {
      method: "POST",
      body: JSON.stringify({
        signedTransaction: signedTx,
        requestId:         data.requestId,
      }),
    }
  );

  return result.txSignature;
}