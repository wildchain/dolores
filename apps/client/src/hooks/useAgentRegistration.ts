"use client";
import { useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  doloresRegistryIdl,
  doloresFundIdl,
  PROGRAM_IDS,
} from "@dolores/contracts";

const REGISTRY_PROGRAM_ID = new PublicKey(PROGRAM_IDS.REGISTRY);
const FUND_PROGRAM_ID = new PublicKey(PROGRAM_IDS.FUND);
const REGISTRY_SEED = Buffer.from("registry");

interface RegistrationParams {
  capabilityHash: number[];
  onSuccess?: (agentPubkey: string, signature: string) => void;
  onError?: (error: Error) => void;
}

export type RegistrationPhase =
  | "idle"
  | "registering"
  | "uploading"
  | "writing_cid"
  | "done"
  | "error";

export function useAgentRegistration() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [registrationPhase, setRegistrationPhase] =
    useState<RegistrationPhase>("idle");
  const [agentKeypair, setAgentKeypair] = useState<Keypair | null>(null);
  const isInFlight = useRef(false);

  const loading =
    registrationPhase !== "idle" &&
    registrationPhase !== "done" &&
    registrationPhase !== "error";

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

    if (isInFlight.current) return;
    isInFlight.current = true;
    setRegistrationPhase("registering");

    try {
      // Create provider (wallet will be used as fallback signer)
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      // Load programs
      const registryProgram = new Program(doloresRegistryIdl as any, provider);
      const fundProgram = new Program(doloresFundIdl as any, provider);

      // Derive the registry PDA
      const [registryPda] = PublicKey.findProgramAddressSync(
        [REGISTRY_SEED, agentKeypair.publicKey.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      // Derive fund PDAs — seeds: ["fund", operator, agent] and ["vault", operator, agent]
      const [fundPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("fund"),
          wallet.publicKey.toBuffer(),
          agentKeypair.publicKey.toBuffer(),
        ],
        FUND_PROGRAM_ID,
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          wallet.publicKey.toBuffer(),
          agentKeypair.publicKey.toBuffer(),
        ],
        FUND_PROGRAM_ID,
      );

      console.log("Registering agent:", agentKeypair.publicKey.toBase58());
      console.log("Registry PDA:", registryPda.toBase58());
      console.log("Fund PDA:", fundPda.toBase58());
      console.log("Capability hash:", capabilityHash);

      // Build register_agent instruction
      const tx = await registryProgram.methods
        .registerAgent(capabilityHash)
        .accounts({
          operator: wallet.publicKey,
          agent: agentKeypair.publicKey,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Append initialize_fund to the same transaction
      const initFundIx = await (fundProgram.methods as any)
        .initializeFund()
        .accounts({
          operator: wallet.publicKey,
          agent: agentKeypair.publicKey,
          fund: fundPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      tx.add(initFundIx);

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
      setRegistrationPhase("error");
      onError?.(error as Error);
    } finally {
      isInFlight.current = false;
    }
  };

  const writeArweaveCid = async (cid: string): Promise<void> => {
    if (!wallet.publicKey || !agentKeypair) {
      throw new Error("Wallet or agent keypair not available");
    }

    setRegistrationPhase("writing_cid");

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const registryProgram = new Program(doloresRegistryIdl as any, provider);

      const [registryPda] = PublicKey.findProgramAddressSync(
        [REGISTRY_SEED, agentKeypair.publicKey.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      await registryProgram.methods
        .writeArweaveCid(cid)
        .accounts({
          authority: wallet.publicKey,
          registry: registryPda,
        })
        .rpc();

      setRegistrationPhase("done");
    } catch (error) {
      console.error("writeArweaveCid failed:", error);
      setRegistrationPhase("error");
      throw error;
    }
  };

  return {
    loading,
    registrationPhase,
    setRegistrationPhase,
    agentKeypair,
    generateAgent,
    downloadKeypair,
    register,
    writeArweaveCid,
  };
}
