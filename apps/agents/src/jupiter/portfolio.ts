import fetch from "node-fetch";

const BASE = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY!;

async function jupiterFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jupiter Portfolio ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

export interface Position {
    platform: string;
    type: string;
    valueUsd: number;
    tokens: Array<{ mint: string; symbol: string; amount: number; valueUsd: number }>;
}

export async function getPortfolio(walletAddress: string): Promise<{
    totalValueUsd: number;
    positions: Position[];
}> {
    const data = await jupiterFetch<{ positions: any[] }>(
        `/portfolio/v1/positions/${walletAddress}`
    );

    const positions: Position[] = (data.positions ?? []).map((p: any) => ({
        platform: p.platform ?? "unknown",
        type: p.type ?? "unknown",
        valueUsd: p.valueUsd ?? 0,
        tokens: (p.tokens ?? []).map((t: any) => ({
            mint: t.mint ?? "",
            symbol: t.symbol ?? "?",
            amount: t.amount ?? 0,
            valueUsd: t.valueUsd ?? 0,
        })),
    }));

    const totalValueUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);

    return { totalValueUsd, positions };
}