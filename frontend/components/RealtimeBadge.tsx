"use client";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealtimeBadgeProps {
  live?: boolean;
  className?: string;
}

/**
 * Badge animé “LIVE” pour indiquer un flux SSE actif
 */
export default function RealtimeBadge({ live = false, className }: RealtimeBadgeProps) {
  return (
    <Badge
      variant={live ? "success" : "outline"}
      className={cn("flex items-center gap-2", live && "animate-pulse-badge", className)}
    >
      <Radio className="h-3.5 w-3.5" />
      <span>{live ? "LIVE" : "OFF"}</span>
    </Badge>
  );
}
