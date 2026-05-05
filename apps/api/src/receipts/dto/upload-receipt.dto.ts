import { IsString, IsNumber, IsIn } from 'class-validator';

export class UploadReceiptDto {
  @IsString()
  agentId: string;

  @IsString()
  taskId: string;

  /** SHA-256 of the canonical receipt JSON, hex-encoded */
  @IsString()
  outputHash: string;

  @IsNumber()
  timestamp: number;

  /** Ed25519 signature of outputHash bytes, hex-encoded */
  @IsString()
  agentSignature: string;

  /** The instruction / capability that was executed */
  @IsString()
  instruction: string;

  /** On-chain transaction signature for the execution */
  @IsString()
  txSignature: string;

  @IsString()
  @IsIn(['success', 'failed'])
  resultStatus: string;

  @IsString()
  resultSummary: string;
}
