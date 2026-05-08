"use client";
import { useState } from "react";
import { Card, RepRing, Badge, Button } from "@/components/ui";
import { formatUsdc } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { AgentDetailsModal } from "./AgentDetailsModal";
import type { Agent } from "@/types";
import type { AgentListItemDto } from "@dolores/shared";

type AgentCardData = Agent | AgentListItemDto;

export function AgentCard({ agent }: { agent: AgentCardData }) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const address =
    agent.agentId ?? ("address" in agent ? (agent.address ?? "") : "");
  const score = agent.trustBadge?.successRate ?? 0;
  const totalTasks = agent.trustBadge?.totalTasks ?? 0;
  const successRate = agent.trustBadge?.successRate ?? 0;
  const staked = agent.stakeAmount ?? agent.trustBadge?.stakeAmount ?? 0;
  const slashCount = "slashCount" in agent ? (agent.slashCount ?? 0) : 0;
  const reputationScore =
    "reputationScore" in agent ? (agent.reputationScore ?? 0) : 0;
  const featured = "featured" in agent ? (agent.featured ?? false) : false;

  return (
    <Card hover className={featured ? "accent-left" : ""}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div
            className="truncate mb-1"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "var(--fs-12)",
              color: "var(--fg-subtle)",
            }}
          >
            {address}
          </div>
          <div
            className="font-semibold"
            style={{
              fontSize: "var(--fs-18)",
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            {agent.name}
          </div>
        </div>
        <RepRing score={reputationScore} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          {
            label: "Staked",
            val: `$${formatUsdc(staked)}`,
            color: "var(--accent)",
          },
          {
            label: "Tasks",
            val: totalTasks.toLocaleString(),
            color: "var(--fg)",
          },
          { label: "Success", val: `${successRate}%`, color: "var(--ok)" },
          {
            label: "Rep",
            val: reputationScore.toString(),
            color: "var(--accent)",
          },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "10px",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-12)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "var(--fs-14)",
                fontWeight: 600,
                color: s.color,
              }}
            >
              {s.val}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {(agent.capabilities || []).map(c => (
          <Badge key={c} cap={c} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1.5"
          style={{ fontSize: "var(--fs-12)", color: "var(--fg-muted)" }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: slashCount === 0 ? "var(--ok)" : "var(--danger)",
              flexShrink: 0,
            }}
          />
          {slashCount === 0
            ? "No slashes"
            : `${slashCount} slash${slashCount > 1 ? "es" : ""}`}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            View
          </Button>
          <Button size="sm" onClick={() => toast(`Hired ${agent.name}`)}>
            Hire
          </Button>
        </div>
      </div>

      <AgentDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        agentId={address}
      />
    </Card>
  );
}
