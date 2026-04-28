import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

/**
 * Load a keypair from a JSON file
 * @param filePath - Path to the keypair JSON file
 * @returns Keypair instance
 */
export function loadKeypairFromFile(filePath: string): Keypair {
  const rawData = fs.readFileSync(filePath, "utf-8");
  const secretKey = Uint8Array.from(JSON.parse(rawData));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Load a keypair from environment variable
 * @param envVarName - Name of the environment variable containing the keypair
 * @returns Keypair instance
 */
export function loadKeypairFromEnv(envVarName: string): Keypair {
  const secretKeyString = process.env[envVarName];
  if (!secretKeyString) {
    throw new Error(`Environment variable ${envVarName} not set`);
  }

  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}
