"use client";
import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { StatTile } from "@/components/ui";
import type { AttestationRecord } from "@/lib/api";
import { usePendingChallenges } from "@/context/PendingChallengesContext";
import {
  buildFileChallengeTransaction,
  isValidTaskId,
  type FailureType,
} from "@/lib/challenge";
import { ScoreBadge } from "./ScoreBadge";

interface AttestationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attestation: AttestationRecord | null;
}

interface ExecutionReceipt {
  schema_version: string;
  task_id: string;
  agent_id: string;
  instruction: string;
  timestamp_unix: number;
  execution: { tx_signature: string };
  result: { status: string; summary: string };
}

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ?? "https://ipfs.dolores.id/get";

const SOLANA_EXPLORER_BASE = "https://explorer.solana.com/tx";
const SOLANA_CLUSTER =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
    ? ""
    : `?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}`;

function explorerUrl(txSig: string) {
  return `${SOLANA_EXPLORER_BASE}/${txSig}${SOLANA_CLUSTER}`;
}

function fmtDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
        {label}:
      </span>
      <span
        style={{
          color: "var(--fg)",
          fontWeight: 600,
          textAlign: "right",
          overflowWrap: "break-word",
          wordBreak: "break-all",
          maxWidth: 340,
        }}
      >
        {value}
      </span>
    </div>
  );
}

type ChallengeStep =
  | "idle"
  | "confirming"
  | "signing"
  | "submitting"
  | "success"
  | "error";

export function AttestationDetailsModal({
  isOpen,
  onClose,
  attestation: a,
}: AttestationDetailsModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const { hasPendingChallenge, getChallengeForTask, refresh } =
    usePendingChallenges();

  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Challenge form state
  const [challengeStep, setChallengeStep] = useState<ChallengeStep>("idle");
  const [failureType, setFailureType] = useState<FailureType>("MissedDeadline");
  const [challengeTxSig, setChallengeTxSig] = useState("");
  const [challengeError, setChallengeError] = useState("");

  useEffect(() => {
    if (!isOpen || !a?.receiptCid) {
      setReceipt(null);
      return;
    }
    let cancelled = false;
    setReceiptLoading(true);
    fetch(`${IPFS_GATEWAY}/${a.receiptCid}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setReceipt(data as ExecutionReceipt);
      })
      .catch(() => {
        if (!cancelled) setReceipt(null);
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, a?.receiptCid]);

  // Reset challenge state when attestation changes
  useEffect(() => {
    setChallengeStep("idle");
    setChallengeError("");
    setChallengeTxSig("");
  }, [a?.agentId, a?.attestedAt, isOpen]);

  if (!a) return null;

  const taskId = receipt?.task_id ?? "";
  const existingChallenge = isValidTaskId(taskId)
    ? getChallengeForTask(taskId)
    : undefined;
  const canChallenge =
    !!publicKey &&
    !!signTransaction &&
    isValidTaskId(taskId) &&
    !existingChallenge &&
    challengeStep === "idle";

  async function handleFileChallenge() {
    if (!publicKey || !signTransaction || !a) return;
    const proofData = a.receiptCid
      ? new TextEncoder().encode(a.receiptCid)
      : new Uint8Array(0);

    try {
      setChallengeStep("signing");
      setChallengeError("");

      const tx = await buildFileChallengeTransaction({
        agentId: a.agentId,
        taskId,
        operatorId: publicKey.toBase58(),
        failureType,
        proofData,
        challengerPublicKey: publicKey,
        connection,
      });

      const signed = await signTransaction(tx);

      setChallengeStep("submitting");
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setChallengeTxSig(sig);
      setChallengeStep("success");
      refresh();
    } catch (err: unknown) {
      setChallengeError(err instanceof Error ? err.message : String(err));
      setChallengeStep("error");
    }
  }

  const outputHex = Array.isArray(a.outputHash)
    ? Buffer.from(a.outputHash).toString("hex")
    : "";

  const repDelta = a.newReputation - a.score;
  const repDeltaLabel =
    repDelta >= 0 ? `+${repDelta} from score` : `${repDelta} from score`;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Attestation Details"
      size="lg"
      centered
      styles={{
        header: {
          background: "var(--bg)",
          borderBottom: "1px solid var(--border-subtle)",
        },
        title: {
          fontFamily: "Inter, sans-serif",
          fontSize: "var(--fs-20)",
          fontWeight: 600,
          color: "var(--fg)",
        },
        body: { background: "var(--bg)" },
        content: {
          background: "var(--bg)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        },
      }}
    >
      <div className="space-y-6">
        {/* Score hero */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius)",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: ".12em",
                marginBottom: 8,
              }}
            >
              Score
            </div>
            <ScoreBadge score={a.score} />
          </div>

          <div
            style={{
              width: 1,
              alignSelf: "stretch",
              background: "var(--border-subtle)",
            }}
          />

          <div className="flex-1 grid grid-cols-2 gap-3">
            <StatTile
              label="New Reputation"
              value={a.newReputation.toString()}
              sub={repDeltaLabel}
              valueStyle={{ color: "var(--accent)" }}
            />
            <StatTile
              label="Attested At"
              value={fmtDateTime(a.attestedAt)}
              valueStyle={{ fontSize: "var(--fs-14)" }}
            />
          </div>
        </div>

        {/* Agent */}
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-12)",
              color: "var(--fg-subtle)",
              textTransform: "uppercase",
              letterSpacing: ".14em",
              marginBottom: 10,
            }}
          >
            Agent
          </div>
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-12)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <KvRow label="Agent ID" value={a.agentId} />
          </div>
        </div>

        {/* Output hash */}
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-12)",
              color: "var(--fg-subtle)",
              textTransform: "uppercase",
              letterSpacing: ".14em",
              marginBottom: 10,
            }}
          >
            Output Hash
          </div>
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 16px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-12)",
              color: "var(--fg-muted)",
              wordBreak: "break-all",
            }}
          >
            {outputHex || "—"}
          </div>
        </div>

        {/* Execution receipt */}
        {(a.receiptCid || receiptLoading) && (
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: ".14em",
                marginBottom: 10,
              }}
            >
              Execution
            </div>
            <div
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: 16,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {receiptLoading ? (
                <div
                  style={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <style>{`
                @keyframes dlrs-spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      borderTopColor: "var(--fg-muted)",
                      display: "inline-block",
                      animation: "dlrs-spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "var(--fs-12)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    Loading receipt…
                  </span>
                </div>
              ) : receipt ? (
                <>
                  <KvRow label="Instruction" value={receipt.instruction} />
                  <KvRow
                    label="Result"
                    value={`${receipt.result.status} — ${receipt.result.summary}`}
                  />
                  <div className="flex justify-between items-start gap-4">
                    <span
                      style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}
                    >
                      Tx:
                    </span>
                    <a
                      href={explorerUrl(receipt.execution.tx_signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--accent)",
                        fontWeight: 600,
                        textAlign: "right",
                        overflowWrap: "break-word",
                        wordBreak: "break-all",
                        maxWidth: 340,
                      }}
                    >
                      {receipt.execution.tx_signature}
                    </a>
                  </div>
                </>
              ) : (
                <span style={{ color: "var(--fg-subtle)" }}>
                  CID: {a.receiptCid}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Already-challenged banner */}
        {existingChallenge && (
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.30)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "#d97706",
                fontWeight: 600,
              }}
            >
              ⚠ You have already filed a challenge for this task
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-11)",
                color: "rgba(217,119,6,0.7)",
              }}
            >
              {existingChallenge.challengePda.slice(0, 8)}...
              {existingChallenge.challengePda.slice(-4)} ·{" "}
              {existingChallenge.status}
            </span>
          </div>
        )}

        {/* File Challenge */}
        {!receiptLoading && (
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: ".14em",
                marginBottom: 10,
              }}
            >
              File Challenge
            </div>

            <div
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Failure type */}
              <div className="flex flex-col gap-1">
                <label
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "var(--fs-11)",
                    color: "var(--fg-muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  Failure Type
                </label>
                <select
                  value={failureType}
                  onChange={e => setFailureType(e.target.value as FailureType)}
                  disabled={challengeStep !== "idle"}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--fg)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "var(--fs-12)",
                    padding: "6px 10px",
                    outline: "none",
                    cursor:
                      challengeStep !== "idle" ? "not-allowed" : "pointer",
                    opacity: challengeStep !== "idle" ? 0.5 : 1,
                  }}
                >
                  <option value="MissedDeadline">Missed Deadline</option>
                  <option value="OutOfScopeCall">Out of Scope Call</option>
                </select>
              </div>

              {/* Status / action */}
              {challengeStep === "idle" && (
                <>
                  <button
                    onClick={() => {
                      setChallengeStep("confirming");
                      setChallengeError("");
                    }}
                    disabled={!canChallenge}
                    style={{
                      background: canChallenge
                        ? "var(--fg)"
                        : "var(--surface-raised)",
                      color: canChallenge ? "var(--bg)" : "var(--fg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "var(--fs-13)",
                      fontWeight: 600,
                      padding: "8px 16px",
                      cursor: canChallenge ? "pointer" : "not-allowed",
                      alignSelf: "flex-start",
                    }}
                  >
                    File Challenge
                  </button>
                  {!publicKey ? (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "var(--fs-11)",
                        color: "var(--fg-subtle)",
                      }}
                    >
                      Connect your wallet to file a challenge.
                    </span>
                  ) : !isValidTaskId(taskId) ? (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "var(--fs-11)",
                        color: "var(--fg-subtle)",
                      }}
                    >
                      This task was not registered on-chain — challenges require
                      a 32-byte task ID.
                    </span>
                  ) : null}
                </>
              )}

              {challengeStep === "confirming" && (
                <div
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "var(--fs-12)",
                      color: "var(--fg)",
                    }}
                  >
                    This will submit an on-chain challenge for task{" "}
                    <strong>{taskId.slice(0, 16)}…</strong> against agent{" "}
                    <strong>{a.agentId.slice(0, 8)}…</strong>. Your wallet must
                    sign and pay fees.
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleFileChallenge}
                      style={{
                        background: "var(--fg)",
                        color: "var(--bg)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "var(--fs-13)",
                        fontWeight: 600,
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setChallengeStep("idle")}
                      style={{
                        background: "transparent",
                        color: "var(--fg-muted)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "var(--fs-13)",
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {(challengeStep === "signing" ||
                challengeStep === "submitting") && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "var(--fs-12)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  {challengeStep === "signing"
                    ? "Waiting for wallet signature…"
                    : "Submitting transaction…"}
                </span>
              )}

              {challengeStep === "success" && (
                <div className="flex flex-col gap-2">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "var(--fs-12)",
                      color: "var(--fg)",
                    }}
                  >
                    Challenge filed ✓
                  </span>
                  <a
                    href={explorerUrl(challengeTxSig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--accent)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "var(--fs-12)",
                      wordBreak: "break-all",
                    }}
                  >
                    {challengeTxSig}
                  </a>
                </div>
              )}

              {challengeStep === "error" && (
                <div className="flex flex-col gap-2">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "var(--fs-12)",
                      color: "#c0392b",
                      wordBreak: "break-all",
                    }}
                  >
                    {challengeError}
                  </span>
                  <button
                    onClick={() => setChallengeStep("idle")}
                    style={{
                      background: "transparent",
                      color: "var(--fg-muted)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "var(--fs-13)",
                      padding: "6px 14px",
                      cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
