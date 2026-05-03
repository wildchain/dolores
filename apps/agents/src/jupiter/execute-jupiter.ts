import Anthropic from "@anthropic-ai/sdk";
import { fetchPrice } from "./price";

const client = new Anthropic();

export const VERIFIED_TOKENS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JTO: "jtojtomepa8berbooxngwuej1y4gbxypibt1mx9buem",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
};


export interface SwapAction {
  action: "swap";
  inputMint: string;
  outputMint: string;
  inputSymbol: string;
  outputSymbol: string;
  amountLamports: number;
  amountSol: number;
  slippageBps: number;
  priceCondition?: { operator: "above" | "below"; thresholdUsd: number };
}

export interface RejectAction {
  action: "reject";
  reason: string;
}

export interface WaitAction {
  action: "wait";
  reason: string;
  currentPrice: number;
  targetPrice: number;
  condition: string;
}

export type JupiterDecision = SwapAction | RejectAction | WaitAction;


export async function executeJupiterTask(
  instruction: string
): Promise<JupiterDecision> {
  const tokenList = Object.keys(VERIFIED_TOKENS).join(", ");

  // Fetch current SOL price to give Claude real context
  const solPrice = await fetchPrice(VERIFIED_TOKENS["SOL"]);
  const solPriceStr = solPrice
    ? `Current SOL price: $${solPrice.priceUsd.toFixed(2)} USD`
    : "SOL price unavailable";

  const system = `You are a DeFi agent parser for Jupiter swaps on Solana.

${solPriceStr}
Supported tokens: ${tokenList}

Parse the instruction and return ONLY a JSON object. No explanation. No markdown. Start with { end with }.

For a simple swap:
{"action":"swap","inputSymbol":"SOL","outputSymbol":"USDC","amountSol":0.001,"slippageBps":50}

For a conditional swap (e.g. "swap if price above $150"):
{"action":"swap","inputSymbol":"SOL","outputSymbol":"USDC","amountSol":0.001,"slippageBps":50,"priceCondition":{"operator":"above","thresholdUsd":150}}

For a swap that should wait (condition not met):
{"action":"wait","reason":"SOL price $X is not above $Y yet","currentPrice":X,"targetPrice":Y,"condition":"above"}

For invalid/out-of-scope:
{"action":"reject","reason":"one sentence"}

Rules:
- Only supported tokens, only Jupiter program
- Max 1 SOL per swap
- Default slippage 50 bps
- If price condition given, check against current SOL price and return wait if not met`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system,
    messages: [{ role: "user", content: instruction }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response");
  }

  const raw = textBlock.text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON in: ${raw}`);

  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error(`Parse failed: ${raw}`);
  }

  // Handle non-swap actions
  if (parsed.action === "reject") return { action: "reject", reason: parsed.reason };
  if (parsed.action === "wait") return parsed as WaitAction;

  // Validate + resolve mints from our map
  const inputSymbol = (parsed.inputSymbol || "SOL").toUpperCase();
  const outputSymbol = (parsed.outputSymbol || "").toUpperCase();

  if (!VERIFIED_TOKENS[inputSymbol]) {
    return { action: "reject", reason: `${inputSymbol} not in verified token list` };
  }
  if (!VERIFIED_TOKENS[outputSymbol]) {
    return { action: "reject", reason: `${outputSymbol} not supported. Use: ${tokenList}` };
  }

  const amountSol = parseFloat(parsed.amountSol) || 0.001;
  const amountLamports = Math.floor(amountSol * 1_000_000_000);

  return {
    action: "swap",
    inputMint: VERIFIED_TOKENS[inputSymbol],
    outputMint: VERIFIED_TOKENS[outputSymbol],
    inputSymbol,
    outputSymbol,
    amountSol,
    amountLamports,
    slippageBps: parsed.slippageBps || 50,
    priceCondition: parsed.priceCondition,
  };
}