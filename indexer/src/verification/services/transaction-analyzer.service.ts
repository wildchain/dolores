import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from '@solana/web3.js';

export interface TokenDelta {
  mint: string;
  amount: number;
  direction: 'in' | 'out';
}

@Injectable()
export class TransactionAnalyzerService {
  private readonly logger = new Logger(TransactionAnalyzerService.name);
  private connection: Connection;

  constructor() {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Fetch transaction from Solana RPC
   */
  async getTransaction(
    signature: string,
  ): Promise<ParsedTransactionWithMeta | null> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });

      if (!tx) {
        this.logger.warn(`Transaction not found: ${signature}`);
        return null;
      }

      return tx;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch transaction ${signature}: ${error?.message ?? error}`,
      );
      return null;
    }
  }

  /**
   * Extract all program IDs called in the transaction
   */
  extractProgramIds(tx: ParsedTransactionWithMeta): string[] {
    const programIds = new Set<string>();

    // From instructions
    tx.transaction.message.instructions.forEach((ix) => {
      if ('programId' in ix) {
        programIds.add(ix.programId.toBase58());
      }
    });

    // From inner instructions
    if (tx.meta?.innerInstructions) {
      tx.meta.innerInstructions.forEach((inner) => {
        inner.instructions.forEach((ix) => {
          if ('programId' in ix) {
            programIds.add(ix.programId.toBase58());
          }
        });
      });
    }

    return Array.from(programIds);
  }

  /**
   * Calculate actual slippage from token balance changes
   */
  calculateActualSlippage(
    tx: ParsedTransactionWithMeta,
    inputMint: string,
    outputMint: string,
    expectedOutput: number,
  ): number {
    const tokenDeltas = this.extractTokenDeltas(tx);

    // Find output token delta
    const outputDelta = tokenDeltas.find(
      (delta) => delta.mint === outputMint && delta.direction === 'in',
    );

    if (!outputDelta) {
      this.logger.warn('Could not find output token delta');
      return 0;
    }

    const actualOutput = outputDelta.amount;
    const slippage = ((expectedOutput - actualOutput) / expectedOutput) * 100;

    return Math.max(0, slippage); // Slippage cannot be negative
  }

  /**
   * Extract token balance changes from transaction
   */
  extractTokenDeltas(tx: ParsedTransactionWithMeta): TokenDelta[] {
    const deltas: TokenDelta[] = [];

    if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
      return deltas;
    }

    // Create a map of account index to balance change
    const balanceChanges = new Map<number, { mint: string; change: number }>();

    tx.meta.preTokenBalances.forEach((pre) => {
      const post = tx.meta!.postTokenBalances!.find(
        (p) => p.accountIndex === pre.accountIndex,
      );

      if (post && pre.mint === post.mint) {
        const preAmount = parseInt(pre.uiTokenAmount.amount);
        const postAmount = parseInt(post.uiTokenAmount.amount);
        const change = postAmount - preAmount;

        if (change !== 0) {
          balanceChanges.set(pre.accountIndex, {
            mint: pre.mint,
            change,
          });
        }
      }
    });

    // Convert to TokenDelta format
    balanceChanges.forEach((value) => {
      deltas.push({
        mint: value.mint,
        amount: Math.abs(value.change),
        direction: value.change > 0 ? 'in' : 'out',
      });
    });

    return deltas;
  }

  /**
   * Extract all token transfers from transaction
   */
  extractTokenTransfers(tx: ParsedTransactionWithMeta): TokenDelta[] {
    return this.extractTokenDeltas(tx);
  }

  /**
   * Get transaction timestamp
   */
  getTransactionTimestamp(tx: ParsedTransactionWithMeta): number | null {
    return tx.blockTime || null;
  }

  /**
   * Check if transaction was confirmed within a deadline
   */
  checkDeadlineMet(tx: ParsedTransactionWithMeta, deadline: number): boolean {
    const txTime = this.getTransactionTimestamp(tx);
    if (!txTime) {
      this.logger.warn('Transaction timestamp not available');
      return false;
    }

    return txTime <= deadline;
  }
}
