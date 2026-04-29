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
            className="text-left p-3.5 rounded-sm transition-all border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: isSelected
                ? "rgba(74,86,64,0.5)"
                : "rgba(174,184,160,0.3)",
              background: isSelected
                ? "rgba(174,184,160,0.18)"
                : "rgba(244,242,237,0.7)",
            }}
          >
            <div
              className="font-mono text-[12px] font-medium mb-1"
              style={{ color: isSelected ? "#4A5640" : "#6B7A5C" }}
            >
              {cap.name}
            </div>
            <div className="text-[11px] text-muted leading-relaxed">
              {cap.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}
