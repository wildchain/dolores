import fetch from "node-fetch";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import * as nacl from "tweetnacl";
import bs58 from "bs58";

const BASE = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY!;

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


export async function getJupiterJwt(agentKeypair: Keypair): Promise<string> {
    // 1a. Request challenge
    const { challenge } = await jupiterFetch<{ challenge: string }>(
        "/trigger/v2/auth/challenge",
        {
            method: "POST",
            body: JSON.stringify({
                walletPubkey: agentKeypair.publicKey.toBase58(),
                type: "message",
            }),
        }
    );

    // 1b. Sign challenge with agent keypair
    const signature = nacl.sign.detached(
        Buffer.from(challenge),
        agentKeypair.secretKey
    );
    const signatureBase58 = bs58.encode(signature);

    // 1c. Verify → get 24-hour JWT
    const { token } = await jupiterFetch<{ token: string }>(
        "/trigger/v2/auth/verify",
        {
            method: "POST",
            body: JSON.stringify({
                type: "message",
                walletPubkey: agentKeypair.publicKey.toBase58(),
                signature: signatureBase58,
            }),
        }
    );

    return token;
}


export interface LimitOrderParams {
    agentKeypair: Keypair;
    jwt: string;
    inputMint: string;
    outputMint: string;
    inputAmount: string;         // in lamports / base units
    triggerPriceUsd: number;      // trigger when price hits this
    triggerCondition: "above" | "below";
    slippageBps?: number;
    expiryMs?: number;         // default 7 days
}

export interface LimitOrderResult {
    orderId: string;
    txSignature: string;
}

export async function createLimitOrder(
    params: LimitOrderParams
): Promise<LimitOrderResult> {
    const { agentKeypair, jwt } = params;

    // 2a. Register vault (safe to call multiple times)
    await jupiterFetch("/trigger/v2/vault/register", {
        method: "GET",
        headers: { Authorization: `Bearer ${jwt}` },
    }).catch(() => { }); // ignore if already registered

    // 2b. Craft deposit transaction
    const deposit = await jupiterFetch<{
        transaction: string;
        requestId: string;
    }>("/trigger/v2/deposit/craft", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            userAddress: agentKeypair.publicKey.toBase58(),
            amount: params.inputAmount,
        }),
    });

    // 2c. Sign deposit transaction
    const depositTx = VersionedTransaction.deserialize(
        Buffer.from(deposit.transaction, "base64")
    );
    depositTx.sign([agentKeypair]);
    const depositSignedTx = Buffer.from(depositTx.serialize()).toString("base64");

    // 2d. Create the limit order
    const order = await jupiterFetch<{
        id: string;
        txSignature: string;
        error?: string;
    }>("/trigger/v2/orders/price", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
            orderType: "single",
            depositRequestId: deposit.requestId,
            depositSignedTx,
            userPubkey: agentKeypair.publicKey.toBase58(),
            inputMint: params.inputMint,
            inputAmount: params.inputAmount,
            outputMint: params.outputMint,
            triggerMint: params.inputMint,
            triggerCondition: params.triggerCondition,
            triggerPriceUsd: params.triggerPriceUsd,
            slippageBps: params.slippageBps ?? 100,
            expiresAt: Date.now() + (params.expiryMs ?? 7 * 24 * 60 * 60 * 1000),
        }),
    });

    if (order.error) throw new Error(`Limit order failed: ${order.error}`);

    return { orderId: order.id, txSignature: order.txSignature };
}


export async function getOrderHistory(jwt: string) {
    return jupiterFetch<{
        orders: Array<{ id: string; orderState: string; triggerPriceUsd: number }>
    }>("/trigger/v2/orders/history", {
        headers: { Authorization: `Bearer ${jwt}` },
    });
}


export async function cancelLimitOrder(
    agentKeypair: Keypair,
    jwt: string,
    orderId: string
): Promise<string> {
    // 4a. Initiate cancellation
    const { transaction, requestId: cancelRequestId } = await jupiterFetch<{
        transaction: string;
        requestId: string;
    }>(`/trigger/v2/orders/price/cancel/${orderId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
    });

    // 4b. Sign withdrawal transaction
    const tx = VersionedTransaction.deserialize(
        Buffer.from(transaction, "base64")
    );
    tx.sign([agentKeypair]);
    const signedTx = Buffer.from(tx.serialize()).toString("base64");

    // 4c. Confirm cancellation
    const result = await jupiterFetch<{ success: boolean }>(
        `/trigger/v2/orders/price/confirm-cancel/${orderId}`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ signedTransaction: signedTx, cancelRequestId }),
        }
    );

    return orderId;
}