export interface CapabilityTemplate {
  template_id: string;
  version: string;
  description: string;
  allowed_operations: AllowedOperation[];
  allowed_programs: string[];
  oracle_source: 'pyth_mainnet' | 'switchboard_v2';
  global_constraints: GlobalConstraints;
  verification_rules: string[];
}

export interface AllowedOperation {
  operation_type: string;
  schema_ref: string;
  constraints: Record<string, any>;
}

export interface GlobalConstraints {
  max_single_transaction_usdc: number;
  require_deadline: boolean;
  max_total_exposure_usdc?: number;
}

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
