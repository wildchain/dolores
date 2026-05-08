"use client";
import { Button } from "@/components/ui";
import { Terminal } from "./Terminal";
import { useWalletState } from "@/hooks/useWalletState";

interface Step1Props {
  onNext: () => void;
}

export function Step1GenerateAgent({ onNext }: Step1Props) {
  const { address, connected } = useWalletState();

  return (
    <div className="animate-fade-up">
      <h2 className="text-[--fs-20] font-semibold text-[--fg] mb-2">
        Generate Agent Identity
      </h2>
      <p className="text-[--fs-14] text-[--fg-muted] mb-6">
        Registration creates a new agent keypair that will sign tasks and
        attestations. This keypair is separate from your operator wallet.
      </p>

      <Terminal
        lines={[
          { text: "$ dolores register", cls: "cmd" },
          { text: "" },
          { text: "🤖 Generating agent keypair..." },
          { text: "✓ Agent keypair generated", cls: "success" },
          { text: "✓ Keypair saved to ~/.dolores/agents/", cls: "success" },
          { text: "" },
          {
            text: "⚠️  Keep this file safe — it's the agent's identity",
            cls: "info",
          },
        ]}
      />

      <div className="bg-[--surface-raised] border border-[--warn] rounded-[--radius-sm] p-4 mb-5">
        <div className="font-mono text-[--fs-12] font-semibold text-[--warn] mb-2">
          ⚠️ IMPORTANT: Keypair Security
        </div>
        <ul className="text-[--fs-14] text-[--fg-muted] space-y-1 list-disc list-inside">
          <li>The agent keypair will be generated in your browser</li>
          <li>You MUST download and save it securely</li>
          <li>The keypair is needed for the agent to sign tasks</li>
          <li>Loss of this keypair means loss of agent identity</li>
        </ul>
      </div>

      {connected && address && (
        <div className="bg-[--primary-subtle] border border-[--border-subtle] rounded-[--radius-sm] p-3.5 mb-5 font-mono text-[--fs-12]">
          <span className="text-[--fg-muted]">Connected operator: </span>
          <span className="text-[--accent]">{address.slice(0, 32)}...</span>
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={onNext}
        disabled={!connected}
      >
        {!connected ? "Connect Wallet First" : "Generate Agent Keypair →"}
      </Button>
    </div>
  );
}
