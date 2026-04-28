import fetch from "node-fetch";

const BASE = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY!;

export interface TokenPrice {
    mint: string;
    symbol: string;
    priceUsd: number;
    confidenceLevel: string;
}

async function jupiterFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jupiter Price API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

// ─── Fetch prices for multiple mints ─────────────────────────────────────────
// Actual response shape (v3):
// { "<mint>": { usdPrice: number, liquidity: number, ... } }

export async function fetchPrices(
    mints: string[]
): Promise<Record<string, TokenPrice | null>> {
    const ids = mints.join(",");

    const data = await jupiterFetch<
        Record<string, {
            usdPrice?: number;
            price?: string;  // fallback
            liquidity?: number;
            decimals?: number;
            priceChange24h?: number;
        } | null>
    >(`/price/v3?ids=${encodeURIComponent(ids)}`);

    const result: Record<string, TokenPrice | null> = {};

    for (const mint of mints) {
        const entry = data[mint];
        if (!entry) {
            result[mint] = null;
            continue;
        }

        // v3 uses usdPrice, fallback to price string
        const priceUsd = entry.usdPrice
            ?? (entry.price ? parseFloat(entry.price) : null);

        if (!priceUsd) {
            result[mint] = null;
            continue;
        }

        result[mint] = {
            mint,
            symbol: mintToSymbol(mint),
            priceUsd,
            confidenceLevel: entry.liquidity && entry.liquidity > 100000 ? "high" : "medium",
        };
    }

    return result;
}

// ─── Fetch single token price ─────────────────────────────────────────────────

export async function fetchPrice(mint: string): Promise<TokenPrice | null> {
    const prices = await fetchPrices([mint]);
    return prices[mint] ?? null;
}

// ─── Helper: mint → symbol ────────────────────────────────────────────────────

function mintToSymbol(mint: string): string {
    const map: Record<string, string> = {
        "So11111111111111111111111111111111111111112": "SOL",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe": "USDT",
        "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd": "BONK",
        "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "WIF",
        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
        "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": "ORCA",
    };
    return map[mint] ?? mint.slice(0, 6) + "...";
}