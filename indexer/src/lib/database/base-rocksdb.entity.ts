/**
 * Base interface for RocksDB entities
 * Unlike TypeORM entities, RocksDB entities are simple POJOs with typed fields
 */
export interface BaseRocksDBEntity {
  id: string; // Primary key - must be unique
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
}

/**
 * Helper to create a new entity with timestamps
 */
export function createEntity<T extends BaseRocksDBEntity>(
  id: string,
  data: Omit<T, keyof BaseRocksDBEntity>,
): T {
  const now = Date.now();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    ...data,
  } as T;
}

/**
 * Helper to update an existing entity
 */
export function updateEntity<T extends BaseRocksDBEntity>(
  entity: T,
  updates: Partial<Omit<T, keyof BaseRocksDBEntity>>,
): T {
  return {
    ...entity,
    ...updates,
    updatedAt: Date.now(),
  };
}

/**
 * Generate composite key for multi-tenant data
 */
export function compositeKey(...parts: string[]): string {
  return parts.join(':');
}

/**
 * Parse composite key
 */
export function parseCompositeKey(key: string): string[] {
  return key.split(':');
}
