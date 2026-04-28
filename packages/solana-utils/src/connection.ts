import { Connection, Commitment } from "@solana/web3.js";

/**
 * Create a Solana connection with standard configuration
 * @param rpcUrl - Solana RPC endpoint URL
 * @param commitment - Transaction commitment level
 * @returns Connection instance
 */
export function createConnection(
  rpcUrl: string,
  commitment: Commitment = "confirmed",
): Connection {
  return new Connection(rpcUrl, commitment);
}

/**
 * Wait for transaction confirmation with retries
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @param maxRetries - Maximum number of retries
 * @param retryDelay - Delay between retries in milliseconds
 * @returns true if confirmed, false if timeout
 */
export async function confirmTransaction(
  connection: Connection,
  signature: string,
  maxRetries = 30,
  retryDelay = 1000,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const status = await connection.getSignatureStatus(signature);

    if (
      status.value?.confirmationStatus === "confirmed" ||
      status.value?.confirmationStatus === "finalized"
    ) {
      return true;
    }

    if (status.value?.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(status.value.err)}`,
      );
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  return false;
}
