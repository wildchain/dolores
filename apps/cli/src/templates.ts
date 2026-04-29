// Re-export canonical types, constants, templates and hashManifest from shared.
// The CLI also has display helpers that are only relevant here.
export {
  CAPABILITY_TEMPLATE_IDS,
  CAPABILITY_TEMPLATES,
  SOLANA_BASE_PROGRAMS,
  SOLANA_TOKEN_PROGRAMS,
  hashManifest,
} from "@dolores/shared";
export type {
  CapabilityManifest,
  CapabilityTemplateId,
  AllowedOperation,
  GlobalConstraints,
} from "@dolores/shared";

import { CAPABILITY_TEMPLATES, CapabilityManifest } from "@dolores/shared";

// ─── CLI display helpers ──────────────────────────────────────────────────────

export function templateChoices(): string {
  return Object.entries(CAPABILITY_TEMPLATES)
    .map(([key, m], i) => `  ${i + 1}. ${key.padEnd(22)} — ${m.description}`)
    .join("\n");
}

export function templateByIndex(
  index: number,
): [string, CapabilityManifest] | null {
  const entries = Object.entries(CAPABILITY_TEMPLATES);
  const entry = entries[index - 1];
  return entry ?? null;
}
