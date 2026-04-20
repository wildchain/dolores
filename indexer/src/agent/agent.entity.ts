import { BaseRocksDBEntity } from '@dolores/lib/database/base-rocksdb.entity';

export interface AgentEntity extends BaseRocksDBEntity {
  id: string; // Agent public key
  // On-chain data is fetched directly from Solana via AgentController
  // This entity is here for potential future off-chain caching
}
