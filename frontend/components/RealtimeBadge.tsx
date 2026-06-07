"use client";
import React from "react";
import { Radio } from "lucide-react";

interface RealtimeBadgeProps {
  live?: boolean;
  className?: string;
}

export default function RealtimeBadge({ live = false }: RealtimeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 cyber-badge font-mono-cyber ${live ? "animate-pulse-badge" : ""}`}
      style={
        live
          ? { background: "rgba(16,185,129,0.1)", color: "#6FB894", border: "1px solid rgba(16,185,129,0.3)" }
          : { background: "rgba(100,116,139,0.08)", color: "#6B7280", border: "1px solid rgba(100,116,139,0.2)" }
      }
    >
      <Radio className="h-3 w-3" />
      {live ? "LIVE" : "OFF"}
    </span>
  );
}
