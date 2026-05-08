export interface AttestationCacheData {
  agentId: string; // Agent pubkey as base58
  score: number; // Raw score 0-100
  outputHash: number[]; // 32-byte output hash
  newReputation: number; // Reputation after this attestation
  attestedAt: number; // Unix timestamp (seconds)
  receiptCid?: string; // IPFS CID of the execution receipt (if available)
}

export class AttestationCacheEntity {
  constructor(public readonly data: AttestationCacheData) {}

  /**
   * Key pattern: attestation:{agentId}:{attestedAt}
   * Enables prefix scan by agentId via `rocksdb.keys('attestation:{agentId}:')`.
   */
  static createKey(agentId: string, attestedAt: number): string {
    return `attestation:${agentId}:${attestedAt}`;
  }

  getKey(): string {
    return AttestationCacheEntity.createKey(
      this.data.agentId,
      this.data.attestedAt,
    );
  }

  toJSON(): string {
    return JSON.stringify(this.data);
  }
}
