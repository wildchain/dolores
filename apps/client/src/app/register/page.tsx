"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { StepIndicator } from "@/components/register/StepIndicator";
import { Step1GenerateAgent } from "@/components/register/Step1GenerateAgent";
import { Step2SelectCapabilities } from "@/components/register/Step2SelectCapabilities";
import { Step3RegisterOnChain } from "@/components/register/Step3RegisterOnChain";
import { useAgentRegistration } from "@/hooks/useAgentRegistration";
import { pinManifest } from "@/lib/ipfs";
import {
  CAPABILITY_TEMPLATES,
  hashManifest,
  type CapabilityTemplateId,
} from "@dolores/shared";

type Step = 1 | 2 | 3;

const STEPS = [
  { number: 1 as Step, label: "Generate" },
  { number: 2 as Step, label: "Configure" },
  { number: 3 as Step, label: "Register" },
];

export default function RegisterPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(
    [],
  );
  const [registrationError, setRegistrationError] = useState<string>();
  const [onChainSignature, setOnChainSignature] = useState<string>();
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    signature: string;
    manifestCid: string;
  }>();

  const {
    loading,
    registrationPhase,
    setRegistrationPhase,
    agentKeypair,
    generateAgent,
    downloadKeypair,
    register,
    writeArweaveCid,
  } = useAgentRegistration();

  const handleStep1Next = () => {
    const keypair = generateAgent();
    setOnChainSignature(undefined);
    setRegistrationError(undefined);
    toast("Agent keypair generated successfully!");
    setStep(2);
  };

  const handleStep2Next = (capabilities: string[]) => {
    setSelectedCapabilities(capabilities);
    setStep(3);
  };

  const handleDownloadKeypair = () => {
    if (!agentKeypair) return;
    downloadKeypair(agentKeypair);
    toast("Keypair downloaded successfully!");
  };

  const handleRegister = async (stakeAmount: string) => {
    if (loading) return;
    if (!agentKeypair) {
      toast("Agent keypair not found", "error");
      return;
    }

    setRegistrationError(undefined);

    const templateId = selectedCapabilities[0] as CapabilityTemplateId;
    const manifest = CAPABILITY_TEMPLATES[templateId];
    if (!manifest) {
      toast("Unknown capability template", "error");
      return;
    }
    const capabilityHash = await hashManifest(manifest);

    // Phase 1: register on-chain — skipped on retry if already succeeded
    let sig = onChainSignature;
    if (!sig) {
      await register({
        capabilityHash,
        onSuccess: (_agentPubkey, signature) => {
          sig = signature;
          setOnChainSignature(signature);
        },
        onError: error => {
          setRegistrationError(error.message);
          toast(error.message, "error");
        },
      });
      if (!sig) return;
    } else {
      setRegistrationPhase("uploading");
    }

    // Phase 2: pin manifest to IPFS
    let manifestCid: string;
    try {
      setRegistrationPhase("uploading");
      manifestCid = await pinManifest(manifest);
    } catch (error) {
      const msg = (error as Error).message ?? "IPFS pin failed";
      setRegistrationError(msg);
      toast(msg, "error");
      setRegistrationPhase("error");
      return;
    }

    // Phase 3: write CID on-chain
    try {
      await writeArweaveCid(manifestCid);
      setRegistrationSuccess({ signature: sig, manifestCid });
      toast("Agent registered successfully!");
    } catch (error) {
      const msg = (error as Error).message ?? "Failed to write CID on-chain";
      setRegistrationError(msg);
      toast(msg, "error");
    }
  };

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="max-w-lg mx-auto">
        <div className="mb-7">
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">
            Onboarding
          </p>
          <h1
            className="font-display text-4xl font-medium text-moss"
            style={{ letterSpacing: "-0.02em" }}
          >
            Register Agent
          </h1>
        </div>

        <StepIndicator current={step} steps={STEPS} />

        {step === 1 && <Step1GenerateAgent onNext={handleStep1Next} />}

        {step === 2 && agentKeypair && (
          <Step2SelectCapabilities
            agentKeypair={agentKeypair}
            onBack={() => setStep(1)}
            onNext={handleStep2Next}
            onDownloadKeypair={handleDownloadKeypair}
          />
        )}

        {step === 3 && agentKeypair && (
          <Step3RegisterOnChain
            agentKeypair={agentKeypair}
            capabilities={selectedCapabilities}
            onBack={() => setStep(2)}
            onRegister={handleRegister}
            loading={loading}
            registrationPhase={registrationPhase}
            error={registrationError}
            success={registrationSuccess}
          />
        )}
      </div>
    </div>
  );
}
