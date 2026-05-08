import * as nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

/**
 * Verify an Ed25519 signature
 * @param message - The message that was signed (as bytes)
 * @param signature - The signature to verify (as bytes)
 * @param publicKey - The public key of the signer
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: PublicKey | string,
): boolean {
  try {
    const pubkeyBytes =
      typeof publicKey === "string"
        ? new PublicKey(publicKey).toBytes()
        : publicKey.toBytes();

    return nacl.sign.detached.verify(message, signature, pubkeyBytes);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Byte array
 * @param prefix - Whether to add 0x prefix
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix = false): string {
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix ? `0x${hex}` : hex;
}
