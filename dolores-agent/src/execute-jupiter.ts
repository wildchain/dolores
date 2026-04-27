import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

// ─── Verified token map — source of truth ─────────────────────────────────────
// Claude cannot hallucinate these — we validate and replace after Claude responds

export const VERIFIED_TOKENS: Record<string, string> = {
  SOL:  "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd",
  WIF:  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JTO:  "jtojtomepa8berbooxngwuej1y4gbxypibt1mx9buem",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY:  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwapAction {
  action:         "swap";
  inputMint:      string;
  outputMint:     string;
  inputSymbol:    string;
  outputSymbol:   string;
  amountLamports: number;
  amountSol:      number;
  slippageBps:    number;
}

export interface RejectAction {
  action: "reject";
  reason: string;
}

export type JupiterDecision = SwapAction | RejectAction;

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function executeJupiterTask(
  instruction: string
): Promise<JupiterDecision> {

  const tokenList = Object.keys(VERIFIED_TOKENS).join(", ");

  // Ask Claude only for symbols and amount — we supply the mints ourselves
  const system = `You are a DeFi agent parser. Extract swap intent from the user instruction.

Supported tokens: ${tokenList}

Respond with ONLY a JSON object. No explanation. No markdown. Start with { end with }.

If the swap is valid (both tokens supported, amount <= 1 SOL):
{
  "action": "swap",
  "inputSymbol": "SOL",
  "outputSymbol": "USDC",
  "amountSol": 0.001,
  "slippageBps": 50
}

If invalid or token not supported:
{
  "action": "reject",
  "reason": "one sentence reason"
}`;

  const response = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 128,
    system,
    messages: [{ role: "user", content: instruction }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const raw   = textBlock.text.trim();
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON in: ${raw}`);

  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error(`Failed to parse: ${raw}`);
  }

  if (parsed.action === "reject") {
    return { action: "reject", reason: parsed.reason };
  }

  // Validate symbols and look up VERIFIED mints — never trust Claude for addresses
  const inputSymbol  = (parsed.inputSymbol  || "SOL").toUpperCase();
  const outputSymbol = (parsed.outputSymbol || "").toUpperCase();

  if (!VERIFIED_TOKENS[inputSymbol]) {
    return { action: "reject", reason: `Input token ${inputSymbol} not in verified list` };
  }
  if (!VERIFIED_TOKENS[outputSymbol]) {
    return { action: "reject", reason: `Output token ${outputSymbol} not in verified list. Supported: ${tokenList}` };
  }

  const amountSol      = parseFloat(parsed.amountSol) || 0.001;
  const amountLamports = Math.floor(amountSol * 1_000_000_000);

  return {
    action:         "swap",
    inputMint:      VERIFIED_TOKENS[inputSymbol],   // ← from our map, not Claude
    outputMint:     VERIFIED_TOKENS[outputSymbol],  // ← from our map, not Claude
    inputSymbol,
    outputSymbol,
    amountSol,
    amountLamports,
    slippageBps:    parsed.slippageBps || 50,
  };
}