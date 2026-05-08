"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/FormInput";
import { CapabilitySelector } from "./CapabilitySelector";
import { RegistrationSummary } from "./RegistrationSummary";
import { CAPABILITY_TEMPLATES } from "@/lib/data";
import type { Keypair } from "@solana/web3.js";

const schema = z.object({
  name: z
    .string()
    .min(1, "Agent name is required")
    .max(50, "Name must be 50 characters or less"),
  description: z
    .string()
    .max(200, "Description must be 200 characters or less"),
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
  onNext: (capabilities: string[], name: string, description: string) => void;
  onDownloadKeypair: () => void;
}

export function Step2SelectCapabilities({
  agentKeypair,
  onBack,
  onNext,
  onDownloadKeypair,
}: Step2Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      capabilities: [],
      confirmDownload: false,
    },
  });

  const capabilities = watch("capabilities");
  const confirmDownload = watch("confirmDownload");

  const onSubmit = (data: FormData) => {
    onNext(data.capabilities, data.name, data.description);
  };

  return (
    <div className="animate-fade-up">
      <h2 className="text-[--fs-20] font-semibold text-[--fg] mb-2">
        Select Capability Template
      </h2>
      <p className="text-[--fs-14] text-[--fg-muted] mb-6">
        Choose the capability template for your agent. This defines what actions
        the agent is authorized to perform.
      </p>

      <div className="bg-[--primary-subtle] border border-[--border-subtle] rounded-[--radius-sm] p-3.5 mb-5 font-mono text-[--fs-12]">
        <span className="text-[--fg-muted]">Agent public key: </span>
        <span className="text-[--accent] break-all">
          {agentKeypair.publicKey.toBase58()}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          name="name"
          control={control as any}
          label="Agent Name"
          placeholder="e.g. DeFi Yield Optimizer"
        />

        <div className="mb-3">
          <label className="font-mono text-[--fs-12] text-[--fg-muted] mb-1.5 block">
            Description{" "}
            <span className="text-[--fg-subtle] font-normal">(optional)</span>
          </label>
          <textarea
            {...register("description")}
            placeholder="Briefly describe what this agent does..."
            rows={3}
            className="w-full bg-[--bg] border border-[--border-subtle] rounded-[--radius-sm] px-3.5 py-2.5 text-[--fg] font-mono text-[--fs-14] placeholder:text-[--fg-subtle] focus:border-[--accent] transition-all outline-none resize-none"
          />
          {errors.description && (
            <p className="text-[--fs-12] text-[--danger] mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

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
                  valueClass: "text-[--accent]",
                },
                {
                  label: "Agent pubkey",
                  value: `${agentKeypair.publicKey.toBase58().slice(0, 16)}...`,
                  valueClass: "text-[--fg-muted]",
                },
                {
                  label: "Network",
                  value: "Solana Devnet",
                  valueClass: "text-[--fg-muted]",
                },
              ]}
            />
          </div>
        )}

        <div className="bg-[--surface-raised] border border-[--warn] rounded-[--radius-sm] p-4 mb-5">
          <div className="font-mono text-[--fs-12] font-semibold text-[--warn] mb-3">
            📥 Download Agent Keypair
          </div>
          <button
            type="button"
            onClick={onDownloadKeypair}
            className="w-full mb-3 font-semibold transition-all duration-150 border px-4 py-2 text-[--fs-14] rounded-[--radius-sm] bg-[--primary-subtle] text-[--accent] border-[--border-subtle] hover:bg-[--primary-hover] hover:border-[--accent]"
          >
            Download agent-{agentKeypair.publicKey.toBase58().slice(0, 8)}.json
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmDownload}
              onChange={e => setValue("confirmDownload", e.target.checked)}
              className="w-4 h-4 rounded border-[--border-strong] text-[--accent] focus:ring-[--accent]"
            />
            <span className="text-[--fs-14] text-[--fg-muted]">
              I have downloaded and saved the keypair securely
            </span>
          </label>
          {errors.confirmDownload && (
            <p className="text-[--fs-12] text-[--danger] mt-2">
              {errors.confirmDownload.message}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 font-semibold transition-all duration-150 border px-4 py-2 text-[--fs-14] rounded-[--radius-sm] bg-[--bg] text-[--fg] border-[--border-subtle] hover:bg-[--surface-raised]"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={!confirmDownload || capabilities.length === 0}
            className="flex-1 font-semibold transition-all duration-150 border px-4 py-2 text-[--fs-14] rounded-[--radius-sm] bg-[--accent] text-[--fg-inverse] border-transparent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Registration →
          </button>
        </div>
      </form>
    </div>
  );
}
