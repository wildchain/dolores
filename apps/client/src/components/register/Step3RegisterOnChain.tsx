"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui";
import { FormInput } from "@/components/forms/FormInput";
import { RegistrationSummary } from "./RegistrationSummary";
import { Terminal } from "./Terminal";
import type { Keypair } from "@solana/web3.js";

const schema = z.object({
  stakeAmount: z
    .string()
    .min(1, "Stake amount is required")
    .refine(val => !isNaN(Number(val)) && Number(val) >= 0.1, {
      message: "Minimum stake is 0.1 SOL",
    }),
});

type FormData = z.infer<typeof schema>;

interface Step3Props {
  agentKeypair: Keypair;
  capabilities: string[];
  onBack: () => void;
  onRegister: (stakeAmount: string) => void;
  loading: boolean;
  error?: string;
  success?: { signature: string };
}

export function Step3RegisterOnChain({
  agentKeypair,
  capabilities,
  onBack,
  onRegister,
  loading,
  error,
  success,
}: Step3Props) {
  const { control, handleSubmit, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      stakeAmount: "",
    },
  });

  const stakeAmount = watch("stakeAmount");
  const slashExposure =
    stakeAmount && !isNaN(Number(stakeAmount))
      ? `${(Number(stakeAmount) * 0.6).toFixed(4)} SOL`
      : "— SOL";

  const onSubmit = (data: FormData) => {
    onRegister(data.stakeAmount);
  };

  if (success) {
    return (
      <div className="animate-fade-up">
        <h2 className="font-display text-2xl font-medium text-moss mb-2">
          Agent Registered Successfully! 🎉
        </h2>
        <p className="text-[14px] text-muted mb-6">
          Your agent is now live on devnet. Reputation builds with every
          verified task.
        </p>

        <Terminal
          lines={[
            { text: "✓ Agent registered on dolores_registry", cls: "success" },
            { text: "✓ Fund initialized on dolores_fund", cls: "success" },
            { text: "" },
            {
              text: `Agent: ${agentKeypair.publicKey.toBase58()}`,
              cls: "info",
            },
            { text: `Transaction: ${success.signature}`, cls: "info" },
            {
              text: `Explorer: https://explorer.solana.com/tx/${success.signature}?cluster=devnet`,
              cls: "info",
            },
          ]}
        />

        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={() => (window.location.href = "/dashboard")}
          >
            View Dashboard →
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/agents")}
          >
            Browse Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl font-medium text-moss mb-2">
        Register On-Chain
      </h2>
      <p className="text-[14px] text-muted mb-6">
        Submit the registration transaction to Solana. Both your operator wallet
        and the agent keypair will sign this transaction.
      </p>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-sm p-4 mb-5 text-danger text-[13px]">
          <strong>Registration Failed:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-5 font-mono text-[11px]">
          <div className="mb-2">
            <span className="text-jadeMid">Agent: </span>
            <span className="text-jadeDark break-all">
              {agentKeypair.publicKey.toBase58()}
            </span>
          </div>
          <div>
            <span className="text-jadeMid">Capabilities: </span>
            <span className="text-jadeDark">{capabilities.join(", ")}</span>
          </div>
        </div>

        <FormInput
          name="stakeAmount"
          control={control}
          label="Initial Stake Amount (SOL)"
          type="number"
          step="0.1"
          placeholder="e.g. 0.5"
        />

        <div className="mb-5">
          <RegistrationSummary
            rows={[
              {
                label: "Templates",
                value: capabilities.join(", "),
                valueClass: "text-jadeDark",
              },
              {
                label: "Initial stake",
                value: stakeAmount ? `${stakeAmount} SOL` : "— SOL",
                valueClass: "text-jadeDeep",
              },
              {
                label: "Slash exposure (60%)",
                value: slashExposure,
                valueClass: "text-danger",
              },
              {
                label: "Dual signature",
                value: "Operator + Agent",
                valueClass: "text-amber",
              },
              {
                label: "Network",
                value: "Solana Devnet",
                valueClass: "text-jadeMid",
              },
            ]}
          />
        </div>

        <div className="bg-amber/10 border border-amber/30 rounded-sm p-4 mb-5">
          <div className="text-[12px] text-muted space-y-1">
            <p>
              <strong>Transaction will:</strong>
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li>Create registry account (signed by agent keypair)</li>
              <li>Initialize fund account (signed by operator wallet)</li>
              <li>Lock capability template on-chain (immutable)</li>
              <li>Set initial reputation score to 0</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onBack}
            disabled={loading}
          >
            ← Back
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Registering on-chain..." : "Register Agent →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
