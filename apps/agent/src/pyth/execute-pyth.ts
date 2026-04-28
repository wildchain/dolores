/**
 * Pyth Network Executor for Dolores Agent
 *
 * Uses Claude Haiku to parse natural-language commands into structured
 * Pyth actions, then fetches live prices from the Hermes API.
 */

import Anthropic from "@anthropic-ai/sdk";
import { HermesClient } from "@pythnetwork/hermes-client";
// import {
//     PRICE_FEEDS,
//     HERMES_ENDPOINT,
//     getFeedId,
//     listSupportedSymbols
// } from "./price-feeds";

import { HERMES_ENDPOINT, PRICE_FEEDS, getFeedId, listSupportedSymbols } from "./price-feeds";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface PythDecision {
    action: "price" | "list" | "reject";
    symbols?: string[];
    reason?: string;
}

export interface PythPriceResult {
    symbol: string;
    feedId: string;
    price: number;
    confidence: number;
    confidencePercent: number;
    publishTime: number;
    ageSeconds: number;
    emaPrice?: number;
    emaConfidence?: number;
}

export interface PythExecutionResult {
    action: "price" | "list" | "reject";
    prices?: PythPriceResult[];
    supportedSymbols?: string[];
    reason?: string;
    timestamp: number;
}

// ============================================================================
// Claude Parser
// ============================================================================

const SKILL_PATH = path.join(__dirname, "..", "..", "skills", "pyth.md");

function loadSkill(): string {
    try {
        return fs.readFileSync(SKILL_PATH, "utf-8");
    } catch {
        // Fallback inline skill if file not found
        return `You are a parser for Pyth Network price feed commands.

Output a single JSON object with this shape:
{
  "action": "price" | "list" | "reject",
  "symbols"?: string[],   // Required for "price"
  "reason"?: string       // Required for "reject"
}

Supported symbols: ${listSupportedSymbols().join(", ")}

Always normalize symbols to uppercase. Reject unsupported symbols.`;
    }
}

export async function parsePythCommand(
    command: string,
    apiKey?: string
): Promise<PythDecision> {
    const anthropic = new Anthropic({
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });

    const skill = loadSkill();

    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: skill,
        messages: [
            {
                role: "user",
                content: command,
            },
        ],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude returned no text response");
    }

    let text = textBlock.text.trim();

    // Strip markdown fences if present
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    let decision: PythDecision;
    try {
        decision = JSON.parse(text);
    } catch (e) {
        throw new Error(`Claude returned invalid JSON: ${text}`);
    }

    // Normalize symbols to uppercase
    if (decision.symbols) {
        decision.symbols = decision.symbols.map((s) => s.toUpperCase());
    }

    return decision;
}

// ============================================================================
// Pyth Executor
// ============================================================================

export async function fetchPrices(symbols: string[]): Promise<PythPriceResult[]> {
    if (symbols.length === 0) {
        throw new Error("No symbols provided");
    }
    if (symbols.length > 10) {
        throw new Error("Maximum 10 symbols per request");
    }

    // Map symbols to feed IDs
    const feedIdMap = new Map<string, string>();
    const unknownSymbols: string[] = [];

    for (const symbol of symbols) {
        const feedId = getFeedId(symbol);
        if (!feedId) {
            unknownSymbols.push(symbol);
        } else {
            feedIdMap.set(feedId.toLowerCase().replace(/^0x/, ""), symbol);
        }
    }

    if (unknownSymbols.length > 0) {
        throw new Error(
            `Unsupported symbol(s): ${unknownSymbols.join(", ")}. ` +
            `Run 'list' to see supported assets.`
        );
    }

    const feedIds = Array.from(feedIdMap.keys()).map((id) => `0x${id}`);

    // Fetch from Hermes
    const client = new HermesClient(HERMES_ENDPOINT);
    const updates = await client.getLatestPriceUpdates(feedIds, {
        parsed: true,
    });

    if (!updates.parsed) {
        throw new Error("No parsed price data returned from Hermes");
    }

    const now = Math.floor(Date.now() / 1000);
    const results: PythPriceResult[] = [];

    for (const update of updates.parsed) {
        const cleanId = update.id.toLowerCase().replace(/^0x/, "");
        const symbol = feedIdMap.get(cleanId);
        if (!symbol) continue;

        const { price, conf, expo, publish_time } = update.price;
        const priceNum = Number(price) * Math.pow(10, expo);
        const confNum = Number(conf) * Math.pow(10, expo);

        const result: PythPriceResult = {
            symbol,
            feedId: `0x${cleanId}`,
            price: priceNum,
            confidence: confNum,
            confidencePercent: (confNum / Math.abs(priceNum)) * 100,
            publishTime: publish_time,
            ageSeconds: now - publish_time,
        };

        if (update.ema_price) {
            const emaPriceNum =
                Number(update.ema_price.price) * Math.pow(10, update.ema_price.expo);
            const emaConfNum =
                Number(update.ema_price.conf) * Math.pow(10, update.ema_price.expo);
            result.emaPrice = emaPriceNum;
            result.emaConfidence = emaConfNum;
        }

        results.push(result);
    }

    // Sort to match input symbol order
    const symbolOrder = new Map(symbols.map((s, i) => [s, i]));
    results.sort(
        (a, b) => (symbolOrder.get(a.symbol) ?? 999) - (symbolOrder.get(b.symbol) ?? 999)
    );

    return results;
}

// ============================================================================
// Top-level dispatch
// ============================================================================

export async function executePythDecision(
    decision: PythDecision
): Promise<PythExecutionResult> {
    const timestamp = Math.floor(Date.now() / 1000);

    if (decision.action === "reject") {
        return {
            action: "reject",
            reason: decision.reason ?? "Rejected by parser",
            timestamp,
        };
    }

    if (decision.action === "list") {
        return {
            action: "list",
            supportedSymbols: listSupportedSymbols(),
            timestamp,
        };
    }

    if (decision.action === "price") {
        if (!decision.symbols || decision.symbols.length === 0) {
            return {
                action: "reject",
                reason: "No symbols provided for price action",
                timestamp,
            };
        }

        const prices = await fetchPrices(decision.symbols);
        return {
            action: "price",
            prices,
            timestamp,
        };
    }

    return {
        action: "reject",
        reason: `Unknown action: ${(decision as any).action}`,
        timestamp,
    };
}

// ============================================================================
// Display helpers
// ============================================================================

export function formatPriceUSD(price: number): string {
    if (Math.abs(price) >= 1) {
        return `$${price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }
    if (Math.abs(price) >= 0.0001) {
        return `$${price.toFixed(6)}`;
    }
    return `$${price.toExponential(4)}`;
}

export function printPriceResults(results: PythPriceResult[]): void {
    console.log("");
    console.log(
        "Symbol".padEnd(8) +
        "Price".padStart(16) +
        "Conf %".padStart(10) +
        "Age".padStart(8) +
        "  Status"
    );
    console.log("-".repeat(50));

    for (const r of results) {
        const status = r.confidencePercent < 1 ? "✅" : r.confidencePercent < 5 ? "⚠️" : "❌";
        const ageStr = `${r.ageSeconds}s`;
        const confStr = `${r.confidencePercent.toFixed(3)}%`;

        console.log(
            r.symbol.padEnd(8) +
            formatPriceUSD(r.price).padStart(16) +
            confStr.padStart(10) +
            ageStr.padStart(8) +
            `  ${status}`
        );
    }
    console.log("");
}