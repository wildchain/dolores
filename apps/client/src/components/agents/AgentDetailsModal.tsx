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
      classNames={{
        header: "bg-stone border-b border-jade/20",
        title: "font-display text-[20px] font-semibold text-moss",
        body: "bg-stone",
        content: "stone-card",
      }}
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted">Loading...</div>
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-sm p-4 text-danger">
          {error}
        </div>
      )}

      {agent && (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start gap-6">
            <RepRing score={agent.trustBadge.successRate} size={80} />
            <div className="flex-1">
              <h3 className="font-display text-[24px] font-semibold text-moss mb-2">
                {agent.name}
              </h3>
              <div className="font-mono text-[11px] text-jade mb-3">
                {agent.agentId}
              </div>
              {agent.description && (
                <p className="text-[14px] text-muted">{agent.description}</p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Reputation Score"
              value={agent.reputationScore.toString()}
              valueClass="text-jade"
            />
            <StatTile
              label="Total Tasks"
              value={agent.trustBadge.totalTasks.toLocaleString()}
              valueClass="text-moss"
            />
            <StatTile
              label="Success Rate"
              value={`${agent.trustBadge.successRate}%`}
              valueClass="text-success"
            />
            <StatTile
              label="Slash Count"
              value={agent.slashCount.toString()}
              valueClass={
                agent.slashCount === 0 ? "text-success" : "text-danger"
              }
            />
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatTile
              label="Staked Amount"
              value={`$${formatUsdc(agent.stakeAmount)}`}
              sub={`${agent.stakeAmount.toLocaleString()} lamports`}
              valueClass="text-jadeDeep"
            />
            <StatTile
              label="Declared Stake"
              value={`$${formatUsdc(agent.declaredStake)}`}
              sub={`${agent.declaredStake.toLocaleString()} lamports`}
              valueClass="text-jadeDeep"
            />
          </div>

          {/* Capabilities */}
          <div>
            <div className="font-mono text-[11px] text-jadeMid uppercase tracking-wider mb-3">
              Capabilities
            </div>
            <div className="flex gap-2 flex-wrap">
              {agent.capabilities.length > 0 ? (
                agent.capabilities.map(cap => <Badge key={cap} cap={cap} />)
              ) : (
                <span className="text-muted text-[13px]">
                  No capabilities listed
                </span>
              )}
            </div>
          </div>

          {/* Blockchain Info */}
          <div className="space-y-3">
            <div className="font-mono text-[11px] text-jadeMid uppercase tracking-wider">
              Blockchain Details
            </div>
            <div className="bg-jade/5 border border-jade/15 rounded-sm p-4 space-y-2 font-mono text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted">Operator:</span>
                <span className="text-moss font-semibold">
                  {agent.operator}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Registry PDA:</span>
                <span className="text-moss font-semibold truncate max-w-[300px]">
                  {agent.registryPda}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fund PDA:</span>
                <span className="text-moss font-semibold truncate max-w-[300px]">
                  {agent.fundPda}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Arweave CID:</span>
                <span className="text-moss font-semibold">
                  {agent.arweaveCid || "Not set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status:</span>
                <span
                  className={agent.isActive ? "text-success" : "text-danger"}
                >
                  {agent.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-jade/5 border border-jade/15 rounded-sm p-3">
              <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">
                Registered At
              </div>
              <div className="text-[13px] text-moss">
                {agent.registeredAt
                  ? formatDate(agent.registeredAt)
                  : "Unknown"}
              </div>
            </div>
            <div className="bg-jade/5 border border-jade/15 rounded-sm p-3">
              <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">
                Last Attested
              </div>
              <div className="text-[13px] text-moss">
                {agent.lastAttestedAt
                  ? formatDate(agent.lastAttestedAt)
                  : "Never"}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <div className="font-mono text-[11px] text-jadeMid uppercase tracking-wider mb-3">
              Performance
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatTile
                label="Completed"
                value={agent.trustBadge.completedTasks.toLocaleString()}
                valueClass="text-success"
              />
              <StatTile
                label="Avg Response Time"
                value={`${agent.trustBadge.avgResponseTime.toFixed(2)}s`}
                valueClass="text-moss"
              />
              <StatTile
                label="Age"
                value={
                  agent.trustBadge.ageSince
                    ? new Date(agent.trustBadge.ageSince).toLocaleDateString()
                    : "Unknown"
                }
                valueClass="text-muted"
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
                className="inline-flex items-center gap-2 text-[13px] text-jade hover:text-jadeDark transition-colors"
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
