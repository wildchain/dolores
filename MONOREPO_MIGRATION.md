# Dolores Monorepo Migration

## Overview

Successfully transformed the Dolores project into a **pnpm monorepo** with shared packages and proper dependency management.

## New Structure

```
dolores/
├── apps/
│   ├── indexer/          # NestJS API & indexer (formerly "indexer/")
│   └── cli/              # CLI tool (formerly "dolores-cli/")
├── packages/
│   ├── shared/           # Shared DTOs, entities, and enums
│   ├── contracts/        # Solana program IDLs and program IDs
│   └── solana-utils/     # Solana utility functions
├── dolores-programs/     # Anchor smart contracts (excluded from workspace)
├── pnpm-workspace.yaml
└── package.json
```

## Packages

### @dolores/shared

**Purpose:** Shared TypeScript interfaces and enums used across the workspace

**Exports:**

- `CreateReceiptDto` - Receipt creation DTO
- `UploadReceiptResponse` - Receipt upload response interface
- `CreateChallengeDto` - Challenge creation DTO
- `ReceiptEntity` - Receipt entity interface
- `ChallengeEntity` - Challenge entity interface
- `ReceiptStatus` - Receipt status enum (Received, PendingReview, Approved, Slashed, SubmissionFailed)
- `ChallengeStatus` - Challenge status enum (Submitted, Failed)
- `BaseEntity` - Base entity with id, createdAt, updatedAt

### @dolores/contracts

**Purpose:** Solana program IDLs and program IDs

**Exports:**

- `PROGRAM_IDS` - Object with ADJUDICATION, FUND, REGISTRY program IDs
- `doloresAdjudicationIdl` - Adjudication program IDL
- `doloresFundIdl` - Fund program IDL
- `doloresRegistryIdl` - Registry program IDL
- Type exports: `DoloresAdjudicationIdl`, `DoloresFundIdl`, `DoloresRegistryIdl`

**Program IDs:**

- Adjudication: `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz`
- Fund: `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5`
- Registry: `3LBwDJqrDqoaimGa5JgpZXx3DiupDsiVHJAgAJTXmRey`

### @dolores/solana-utils

**Purpose:** Solana utility functions for signature verification, keypair loading, and connections

**Exports:**

- `verifySignature(message, signature, publicKey)` - Ed25519 signature verification
- `hexToBytes(hex)` - Convert hex string to Uint8Array
- `bytesToHex(bytes, prefix?)` - Convert Uint8Array to hex string
- `loadKeypairFromFile(filePath)` - Load Solana keypair from JSON file
- `loadKeypairFromEnv(envVarName)` - Load keypair from environment variable
- `createConnection(rpcUrl, commitment?)` - Create Solana connection
- `confirmTransaction(connection, signature, maxRetries?, retryDelay?)` - Confirm transaction with retries

## Migration Changes

### Indexer (apps/indexer)

- ✅ Updated to use `@dolores/shared` for DTOs and entities
- ✅ Updated to use `@dolores/contracts` for program IDLs and IDs
- ✅ Updated to use `@dolores/solana-utils` for signature verification
- ✅ Removed duplicate DTO definitions
- ✅ Renamed package from "dolores" to "indexer"

### CLI (apps/cli)

- ✅ Updated to use `@dolores/shared` for DTOs and response types
- ✅ Updated to use `@dolores/contracts` for program IDLs and IDs
- ✅ Updated to use `@dolores/solana-utils` for keypair loading
- ✅ Fixed type errors in run.ts (fetchReputation return type, UploadReceiptResponse fields)
- ✅ Renamed package from "dolores-cli" to "@dolores/cli"

## Build System

### TypeScript Project References

All packages and apps use TypeScript composite builds with project references for:

- Incremental compilation
- Type-safe cross-package imports
- Fast rebuild times

### Build Scripts

```bash
# Build all packages and apps
pnpm build

# Build only packages
pnpm -r --filter='./packages/*' build

# Build only apps
pnpm -r --filter='./apps/*' build

# Build specific package/app
pnpm --filter @dolores/shared build
pnpm --filter indexer build
pnpm --filter @dolores/cli build

# Development
pnpm dev:indexer   # Start indexer in watch mode
pnpm dev:cli       # Build CLI in watch mode

# Clean all build outputs
pnpm clean

# Run tests (when available)
pnpm test

# Lint (when configured)
pnpm lint
```

## Validation

### Build Status

✅ All packages compile successfully:

- packages/shared
- packages/contracts
- packages/solana-utils

✅ All apps compile successfully:

- apps/indexer
- apps/cli

### Runtime Validation

✅ Indexer starts successfully with workspace dependencies
✅ CLI executable works correctly with workspace dependencies
✅ All routes and modules load properly
✅ TypeScript types resolve correctly across packages

## Key Benefits

1. **Code Reuse:** Shared DTOs, entities, and utilities eliminate duplication
2. **Type Safety:** TypeScript project references ensure type consistency across packages
3. **Faster Builds:** Incremental compilation and workspace caching
4. **Dependency Management:** pnpm workspace protocol (`workspace:*`) ensures local packages stay in sync
5. **Scalability:** Easy to add new packages or apps as the project grows

## Notes

- `dolores-programs/` folder is excluded from the pnpm workspace (Rust/Anchor contracts)
- The monorepo uses `shamefully-hoist=true` for better compatibility with some dependencies
- All workspace dependencies use the `workspace:*` protocol
- TypeScript version is locked to 5.4.5 at the root for consistency

## Next Steps

Consider future enhancements:

- Extract RocksDB utilities to `@dolores/database` package
- Add `@dolores/testing` package for shared test utilities
- Add `@dolores/config` package for shared configuration
- Set up Turborepo or Nx for advanced monorepo features
