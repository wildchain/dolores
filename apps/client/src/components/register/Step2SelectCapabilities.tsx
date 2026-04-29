"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui";
import { CapabilitySelector } from "./CapabilitySelector";
import { RegistrationSummary } from "./RegistrationSummary";
import { CAPABILITY_TEMPLATES } from "@/lib/data";
import type { Keypair } from "@solana/web3.js";

const schema = z.object({
  capabilities: z
    .array(z.string())
    .min(1, "Select at least one capability template"),
  confirmDownload: z.boolean().refine(val => val === true, {
    message: "You must confirm downloading the keypair",
  }),
});

type FormData = z.infer<typeof schema>;

interface Step2Props {
  agentKeypair: Keypair;
  onBack: () => void;
  onNext: (capabilities: string[]) => void;
  onDownloadKeypair: () => void;
}

export function Step2SelectCapabilities({
  agentKeypair,
  onBack,
  onNext,
  onDownloadKeypair,
}: Step2Props) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      capabilities: [],
      confirmDownload: false,
    },
  });

  const capabilities = watch("capabilities");
  const confirmDownload = watch("confirmDownload");

  const onSubmit = (data: FormData) => {
    onNext(data.capabilities);
  };

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl font-medium text-moss mb-2">
        Select Capability Template
      </h2>
      <p className="text-[14px] text-muted mb-6">
        Choose the capability template for your agent. This defines what actions
        the agent is authorized to perform.
      </p>

      <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-5 font-mono text-[11px]">
        <span className="text-jadeMid">Agent public key: </span>
        <span className="text-jadeDark break-all">
          {agentKeypair.publicKey.toBase58()}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-5">
          <CapabilitySelector
            capabilities={CAPABILITY_TEMPLATES}
            selected={capabilities}
            onChange={selected => setValue("capabilities", selected)}
          />
          {errors.capabilities && (
            <p className="text-[11px] text-danger mt-2">
              {errors.capabilities.message}
            </p>
          )}
        </div>

        {capabilities.length > 0 && (
          <div className="mb-5">
            <RegistrationSummary
              rows={[
                {
                  label: "Selected templates",
                  value: capabilities.join(", "),
                  valueClass: "text-jadeDark",
                },
                {
                  label: "Agent pubkey",
                  value: `${agentKeypair.publicKey.toBase58().slice(0, 16)}...`,
                  valueClass: "text-jadeMid",
                },
                {
                  label: "Network",
                  value: "Solana Devnet",
                  valueClass: "text-jadeMid",
                },
              ]}
            />
          </div>
        )}

        <div className="bg-amber/10 border border-amber/30 rounded-sm p-4 mb-5">
          <div className="font-mono text-[11px] font-semibold text-amber mb-3">
            📥 Download Agent Keypair
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full mb-3"
            onClick={onDownloadKeypair}
          >
            Download agent-{agentKeypair.publicKey.toBase58().slice(0, 8)}.json
          </Button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmDownload}
              onChange={e => setValue("confirmDownload", e.target.checked)}
              className="w-4 h-4 rounded border-jade/30 text-jadeDeep focus:ring-jadeDeep"
            />
            <span className="text-[12px] text-muted">
              I have downloaded and saved the keypair securely
            </span>
          </label>
          {errors.confirmDownload && (
            <p className="text-[11px] text-danger mt-2">
              {errors.confirmDownload.message}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onBack}
          >
            ← Back
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={!confirmDownload || capabilities.length === 0}
          >
            Continue to Registration →
          </Button>
        </div>
      </form>
    </div>
  );
}
