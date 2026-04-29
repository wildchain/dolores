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
      <h2 className="font-display text-2xl font-medium text-moss mb-2">
        Generate Agent Identity
      </h2>
      <p className="text-[14px] text-muted mb-6">
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

      <div className="bg-amber/10 border border-amber/30 rounded-sm p-4 mb-5">
        <div className="font-mono text-[11px] font-semibold text-amber mb-2">
          ⚠️ IMPORTANT: Keypair Security
        </div>
        <ul className="text-[12px] text-muted space-y-1 list-disc list-inside">
          <li>The agent keypair will be generated in your browser</li>
          <li>You MUST download and save it securely</li>
          <li>The keypair is needed for the agent to sign tasks</li>
          <li>Loss of this keypair means loss of agent identity</li>
        </ul>
      </div>

      {connected && address && (
        <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-5 font-mono text-[11px]">
          <span className="text-jadeMid">Connected operator: </span>
          <span className="text-jadeDark">{address.slice(0, 32)}...</span>
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
