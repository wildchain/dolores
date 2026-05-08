/**
 * Program IDs for Dolores Protocol contracts
 */
export const PROGRAM_IDS = {
  REGISTRY: "3LBwDJqrDqoaimGa5JgpZXx3DiupDsiVHJAgAJTXmRey",
  FUND: "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5",
  ADJUDICATION: "4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz",
};

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
