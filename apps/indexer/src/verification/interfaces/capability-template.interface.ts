import {
  CapabilityManifest,
  AllowedOperation,
  GlobalConstraints,
} from '@dolores/shared';

// Re-export shared types so existing consumers of this file need no changes.
export type { AllowedOperation, GlobalConstraints };

/**
 * CapabilityTemplate is the indexer's name for the canonical CapabilityManifest.
 * All verification services use this alias so they continue to work unchanged.
 */
export type CapabilityTemplate = CapabilityManifest;

export interface ConstraintViolation {
  rule: string;
  expected: any;
  actual: any;
  severity: 'critical' | 'high' | 'medium';
  proof?: any;
}

export interface VerificationResult {
  valid: boolean;
  violations?: ConstraintViolation[];
  proof?: any;
}

export interface ExecutionReceipt {
  schema_version: string;
  task_id: string;
  agent_id: string;
  operator: string;
  assigned_by: string;
  timestamp_unix: number;
  operation_type: string;
  operation_details: Record<string, any>;
  execution: {
    tx_signatures: string[];
    programs_called: string[];
    instructions_executed: string[];
    token_transfers?: TokenTransfer[];
  };
  result: {
    status: 'success' | 'failure';
    summary: string;
  };
}

export interface TokenTransfer {
  mint: string;
  amount: number;
  direction: 'in' | 'out';
}
