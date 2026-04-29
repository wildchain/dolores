"use client";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { doloresRegistryIdl, PROGRAM_IDS } from "@dolores/contracts";

const REGISTRY_PROGRAM_ID = new PublicKey(PROGRAM_IDS.REGISTRY);
const REGISTRY_SEED = Buffer.from("registry");

interface RegistrationParams {
  capabilityHash: number[];
  onSuccess?: (agentPubkey: string, signature: string) => void;
  onError?: (error: Error) => void;
}

export function useAgentRegistration() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [agentKeypair, setAgentKeypair] = useState<Keypair | null>(null);

  const generateAgent = () => {
    const keypair = Keypair.generate();
    setAgentKeypair(keypair);
    return keypair;
  };

  const downloadKeypair = (keypair: Keypair) => {
    const secretKeyArray = Array.from(keypair.secretKey);
    const blob = new Blob([JSON.stringify(secretKeyArray)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-${keypair.publicKey.toBase58()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const register = async ({
    capabilityHash,
    onSuccess,
    onError,
  }: RegistrationParams) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      onError?.(new Error("Wallet not connected"));
      return;
    }

    if (!agentKeypair) {
      onError?.(new Error("Agent keypair not generated"));
      return;
    }

    setLoading(true);

    try {
      // Create provider (wallet will be used as fallback signer)
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      // Load the registry program
      const registryProgram = new Program(doloresRegistryIdl as any, provider);

      // Derive the registry PDA
      const [registryPda] = PublicKey.findProgramAddressSync(
        [REGISTRY_SEED, agentKeypair.publicKey.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      console.log("Registering agent:", agentKeypair.publicKey.toBase58());
      console.log("Registry PDA:", registryPda.toBase58());
      console.log("Capability hash:", capabilityHash);

      // Build the transaction
      const tx = await registryProgram.methods
        .registerAgent(capabilityHash)
        .accounts({
          operator: wallet.publicKey,
          agent: agentKeypair.publicKey,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = wallet.publicKey;

      // Agent signs first (we have the keypair)
      tx.partialSign(agentKeypair);

      // Operator signs via wallet (Phantom will prompt here)
      const signedTx = await wallet.signTransaction(tx);

      // Send the transaction
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      console.log("Transaction sent:", signature);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmation.value.err) {
        throw new Error("Transaction failed: " + confirmation.value.err);
      }

      console.log("Transaction confirmed:", signature);

      onSuccess?.(agentKeypair.publicKey.toBase58(), signature);
    } catch (error) {
      console.error("Registration failed:", error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    agentKeypair,
    generateAgent,
    downloadKeypair,
    register,
  };
}
