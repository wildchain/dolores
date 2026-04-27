import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env



export interface TransferAction {
    action: "transfer";
    recipient: string;
    amountSol: number;
    amountLamports: number;
}

export interface RejectAction {
    action: "reject";
    reason: string;
}

export type AgentDecision = TransferAction | RejectAction;

// ─── Load skill ───────────────────────────────────────────────────────────────

function loadSkill(templateName: string): string {
    const skillFile = path.join(
        __dirname,
        "../skills",
        `${templateName.toLowerCase().replace("_", "-")}.md`
    );

    if (!fs.existsSync(skillFile)) {
        throw new Error(
            `Skill file not found for template ${templateName}: ${skillFile}`
        );
    }

    return fs.readFileSync(skillFile, "utf-8");
}


export async function executeTask(
    instruction: string,
    template: string // e.g. "SOL_TRANSFER"
): Promise<AgentDecision> {
    const skillContext = loadSkill(template);

    const response = await client.messages.create({
        // model: "claude-sonnet-4-20250514",
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: skillContext,
        messages: [
            {
                role: "user",
                content: instruction,
            },
        ],
    });

    // Extract text content
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude returned no text content");
    }

    const raw = textBlock.text.trim();

    const clean = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

    let decision: AgentDecision;
    try {
        decision = JSON.parse(clean);
    } catch {
        throw new Error(`Claude returned non-JSON response: ${raw}`);
    }


    if (decision.action !== "transfer" && decision.action !== "reject") {
        throw new Error(`Unknown action in Claude response: ${(decision as any).action}`);
    }

    return decision;
}