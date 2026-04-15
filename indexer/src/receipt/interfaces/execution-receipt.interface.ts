export interface TokenTransfer {
  mint: string;
  amount: number;
  direction: 'in' | 'out';
}

export interface ExecutionDetails {
  tx_signatures: string[];
  programs_called: string[];
  instructions_executed: string[];
  token_transfers: TokenTransfer[];
}

export interface ExecutionResult {
  status: 'success' | 'failed';
  summary: string;
}

export interface ExecutionReceipt {
  schema_version: string;
  task_id: string;
  agent_id: string;
  operator: string;
  assigned_by: string;
  timestamp_unix: number;
  execution: ExecutionDetails;
  result: ExecutionResult;
}
