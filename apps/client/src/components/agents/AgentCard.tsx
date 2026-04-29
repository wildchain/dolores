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
    <Card hover className={featured ? "border-l-2 border-l-jadeDark" : ""}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div className="font-mono text-[10px] text-jade mb-1 truncate">
            {address}
          </div>
          <div
            className="font-display text-[18px] font-medium text-moss"
            style={{ letterSpacing: "-0.01em" }}
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
            cls: "text-jadeDeep font-semibold",
          },
          {
            label: "Tasks",
            val: totalTasks.toLocaleString(),
            cls: "text-moss",
          },
          { label: "Success", val: `${successRate}%`, cls: "text-success" },
          { label: "Rep", val: reputationScore.toString(), cls: "text-jade" },
        ].map(s => (
          <div
            key={s.label}
            className="bg-jade/10 border border-jade/20 rounded-sm p-2.5"
          >
            <div className="font-mono text-[10px] text-jade mb-1">
              {s.label}
            </div>
            <div className={`font-display text-[14px] ${s.cls}`}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {(agent.capabilities || []).map(c => (
          <Badge key={c} cap={c} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <div
            className={`w-1.5 h-1.5 rounded-full ${slashCount === 0 ? "bg-success" : "bg-danger"}`}
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
