/**
 * Program IDs for Dolores Protocol contracts
 */
export const PROGRAM_IDS = {
  ADJUDICATION: "8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A",
  FUND: "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5",
  REGISTRY: "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt",
} as const;

// Use require for JSON imports to work with composite builds
const doloresAdjudicationIdl = require("./idl/dolores_adjudication.json");
const doloresFundIdl = require("./idl/dolores_fund.json");
const doloresRegistryIdl = require("./idl/dolores_registry.json");

/**
 * IDL exports for Anchor integration
 */
export const IDLs = {
  adjudication: doloresAdjudicationIdl,
  fund: doloresFundIdl,
  registry: doloresRegistryIdl,
} as const;

// Export individual IDLs
export { doloresAdjudicationIdl, doloresFundIdl, doloresRegistryIdl };

// Type exports for TypeScript
export type DoloresAdjudicationIdl = typeof doloresAdjudicationIdl;
export type DoloresFundIdl = typeof doloresFundIdl;
export type DoloresRegistryIdl = typeof doloresRegistryIdl;
