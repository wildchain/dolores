"use client";
import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import { StatTile } from "@/components/ui";
import type { AttestationRecord } from "@/lib/api";
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
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ?? "http://localhost:3002/get";

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

export function AttestationDetailsModal({
  isOpen,
  onClose,
  attestation: a,
}: AttestationDetailsModalProps) {
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

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

  if (!a) return null;

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
                <span style={{ color: "var(--fg-subtle)" }}>
                  Loading receipt…
                </span>
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
      </div>
    </Modal>
  );
}
