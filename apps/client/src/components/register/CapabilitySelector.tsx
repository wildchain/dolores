"use client";
import { useState } from "react";

interface Capability {
  id: string;
  name: string;
  desc: string;
}

interface CapabilitySelectorProps {
  capabilities: Capability[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function CapabilitySelector({
  capabilities,
  selected,
  onChange,
  disabled = false,
}: CapabilitySelectorProps) {
  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selected.includes(id)
        ? selected.filter(x => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {capabilities.map(cap => {
        const isSelected = selected.includes(cap.id);
        return (
          <button
            key={cap.id}
            onClick={() => toggle(cap.id)}
            disabled={disabled}
            className="text-left p-3.5 rounded-[--radius-sm] transition-all border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: isSelected
                ? "var(--accent)"
                : "var(--border-subtle)",
              background: isSelected
                ? "var(--primary-subtle)"
                : "var(--surface-raised)",
            }}
          >
            <div
              className="font-mono text-[--fs-12] font-medium mb-1"
              style={{
                color: isSelected ? "var(--accent)" : "var(--fg-muted)",
              }}
            >
              {cap.name}
            </div>
            <div className="text-[--fs-12] text-[--fg-muted] leading-relaxed">
              {cap.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}
