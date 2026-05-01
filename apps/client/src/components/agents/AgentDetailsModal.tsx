"use client";
import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import { Badge, RepRing, StatTile } from "@/components/ui";
import { formatUsdc } from "@/lib/data";
import { ApiClient } from "@/lib/api";
import type { AgentDetailsDto } from "@dolores/shared";

interface AgentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

export function AgentDetailsModal({
  isOpen,
  onClose,
  agentId,
}: AgentDetailsModalProps) {
  const [agent, setAgent] = useState<AgentDetailsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && agentId) {
      fetchAgentDetails();
    }
  }, [isOpen, agentId]);

  const fetchAgentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = new ApiClient();
      const response = await apiClient.agents.getAgentDetails(agentId);
      setAgent(response.data);
    } catch (err) {
      console.error("Failed to fetch agent details:", err);
      setError("Failed to load agent details");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Agent Details"
      size="xl"
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
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div style={{ color: "var(--fg-muted)", fontSize: "var(--fs-14)" }}>
            Loading...
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            color: "var(--danger)",
            fontSize: "var(--fs-14)",
          }}
        >
          {error}
        </div>
      )}

      {agent && (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start gap-6">
            <RepRing score={agent.trustBadge.successRate} size={80} />
            <div className="flex-1">
              <h3
                style={{
                  fontSize: "var(--fs-24)",
                  fontWeight: 600,
                  color: "var(--fg)",
                  marginBottom: 6,
                }}
              >
                {agent.name}
              </h3>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "var(--fs-12)",
                  color: "var(--fg-subtle)",
                  marginBottom: 10,
                }}
              >
                {agent.agentId}
              </div>
              {agent.description && (
                <p
                  style={{ fontSize: "var(--fs-14)", color: "var(--fg-muted)" }}
                >
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Reputation Score"
              value={agent.reputationScore.toString()}
              valueStyle={{ color: "var(--accent)" }}
            />
            <StatTile
              label="Total Tasks"
              value={agent.trustBadge.totalTasks.toLocaleString()}
            />
            <StatTile
              label="Success Rate"
              value={`${agent.trustBadge.successRate}%`}
              valueStyle={{ color: "var(--ok)" }}
            />
            <StatTile
              label="Slash Count"
              value={agent.slashCount.toString()}
              valueStyle={{
                color: agent.slashCount === 0 ? "var(--ok)" : "var(--danger)",
              }}
            />
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatTile
              label="Staked Amount"
              value={`$${formatUsdc(agent.stakeAmount)}`}
              sub={`${agent.stakeAmount.toLocaleString()} lamports`}
              valueStyle={{ color: "var(--accent)" }}
            />
            <StatTile
              label="Declared Stake"
              value={`$${formatUsdc(agent.declaredStake)}`}
              sub={`${agent.declaredStake.toLocaleString()} lamports`}
              valueStyle={{ color: "var(--accent)" }}
            />
          </div>

          {/* Capabilities */}
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
              Capabilities
            </div>
            <div className="flex gap-2 flex-wrap">
              {agent.capabilities.length > 0 ? (
                agent.capabilities.map(cap => <Badge key={cap} cap={cap} />)
              ) : (
                <span
                  style={{ fontSize: "var(--fs-14)", color: "var(--fg-muted)" }}
                >
                  No capabilities listed
                </span>
              )}
            </div>
          </div>

          {/* Blockchain Info */}
          <div className="space-y-3">
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: ".14em",
              }}
            >
              Blockchain Details
            </div>
            <div
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
              }}
            >
              {(
                [
                  ["Operator", agent.operator],
                  ["Registry PDA", agent.registryPda],
                  ["Fund PDA", agent.fundPda],
                  ["Arweave CID", agent.arweaveCid || "Not set"],
                ] as [string, string][]
              ).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span style={{ color: "var(--fg-muted)" }}>{key}:</span>
                  <span
                    style={{
                      color: "var(--fg)",
                      fontWeight: 600,
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}
              <div className="flex justify-between">
                <span style={{ color: "var(--fg-muted)" }}>Status:</span>
                <span
                  style={{
                    color: agent.isActive ? "var(--ok)" : "var(--danger)",
                    fontWeight: 600,
                  }}
                >
                  {agent.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              [
                [
                  "Registered At",
                  agent.registeredAt
                    ? formatDate(agent.registeredAt)
                    : "Unknown",
                ],
                [
                  "Last Attested",
                  agent.lastAttestedAt
                    ? formatDate(agent.lastAttestedAt)
                    : "Never",
                ],
              ] as [string, string][]
            ).map(([label, val]) => (
              <div
                key={label}
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "var(--fs-12)",
                    color: "var(--fg-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: ".14em",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: "var(--fs-14)", color: "var(--fg)" }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Performance Metrics */}
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
              Performance
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatTile
                label="Completed"
                value={agent.trustBadge.completedTasks.toLocaleString()}
                valueStyle={{ color: "var(--ok)" }}
              />
              <StatTile
                label="Avg Response Time"
                value={`${agent.trustBadge.avgResponseTime.toFixed(2)}s`}
              />
              <StatTile
                label="Age"
                value={
                  agent.trustBadge.ageSince
                    ? new Date(agent.trustBadge.ageSince).toLocaleDateString()
                    : "Unknown"
                }
                valueStyle={{ color: "var(--fg-muted)" }}
              />
            </div>
          </div>

          {/* Manifest Link */}
          {agent.manifestUrl && (
            <div>
              <a
                href={agent.manifestUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--fs-14)",
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--fg)")
                }
                onMouseLeave={e =>
                  ((e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--accent)")
                }
              >
                <span>View Manifest on Arweave</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 17L17 7M17 7H7M17 7V17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
