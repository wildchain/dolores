# Dolores Monorepo - Shared Database Package

## What Changed

Created **@dolores/database** package to share RocksDB utilities between indexer and API.

## New Package Structure

```
packages/database/
├── src/
│   ├── rocksdb.service.ts     # RocksDB operations
│   ├── database.module.ts     # NestJS module
│   ├── base-rocksdb.entity.ts # Entity helpers
│   ├── class-validator.ts     # Validation utilities
│   └── index.ts               # Exports
├── package.json
└── tsconfig.json
```

## Apps Using @dolores/database

### Indexer (apps/indexer)

- ✅ Updated imports from `./lib/database` to `@dolores/database`
- ✅ Removed local `apps/indexer/src/lib/database/` folder
- ✅ Uses shared DatabaseModule and RocksDBService

### API (apps/api) - NEW

- ✅ New NestJS application on port 3001
- ✅ Uses @dolores/database for persistence
- ✅ Configured with all shared packages
- ✅ Ready for UI backend development

## Package Exports

```typescript
import {
  RocksDBService,
  DatabaseModule,
  BaseRocksDBEntity,
  createEntity,
  updateEntity,
  compositeKey,
  parseCompositeKey,
} from "@dolores/database";
```

## Benefits

1. **No Code Duplication** - Database logic defined once
2. **Consistent Data Access** - Both apps use same interfaces
3. **Independent Databases** - Each app connects to its own RocksDB instance
4. **Type Safety** - Shared entity interfaces
5. **Easy Testing** - Mock RocksDBService in tests

## Build Commands

```bash
# Build everything
pnpm build

# Start indexer (port 3000)
pnpm dev:indexer

# Start API (port 3001)
pnpm dev:api

# Build specific package
pnpm --filter @dolores/database build
```

## Validation

✅ All 4 packages build: shared, contracts, database, solana-utils  
✅ All 3 apps build: indexer, api, cli  
✅ Indexer starts successfully with @dolores/database  
✅ API starts successfully with @dolores/database  
✅ RocksDB connections work in both applications

## Next Steps

The API app is now ready for:

- Adding REST endpoints for UI
- Implementing authentication
- Creating query endpoints for agent/receipt data
- Building the frontend interface
