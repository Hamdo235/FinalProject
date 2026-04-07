import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  accent?: "cyan" | "amber" | "red" | "green" | "blue";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

const accentMap = {
  cyan:  { top: "stat-cyan",  icon: "rgba(34,211,238,0.1)",  iconBorder: "rgba(34,211,238,0.2)",  val: "#67e8f9" },
  amber: { top: "stat-amber", icon: "rgba(245,158,11,0.1)",  iconBorder: "rgba(245,158,11,0.25)", val: "#fbbf24" },
  red:   { top: "stat-red",   icon: "rgba(239,68,68,0.1)",   iconBorder: "rgba(239,68,68,0.25)",  val: "#f87171" },
  green: { top: "stat-green", icon: "rgba(16,185,129,0.1)",  iconBorder: "rgba(16,185,129,0.25)", val: "#34d399" },
  blue:  { top: "stat-blue",  icon: "rgba(59,130,246,0.1)",  iconBorder: "rgba(59,130,246,0.25)", val: "#93c5fd" },
};

export default function MetricCard({
  title, value, subtitle, loading, icon, accent = "cyan", trend, trendValue,
}: MetricCardProps) {
  const a = accentMap[accent];
  return (
    <div
      className={`cyber-card ${a.top} p-4 flex flex-col gap-3`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
          {title}
        </span>
        {icon && (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: a.icon, border: `1px solid ${a.iconBorder}` }}
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-2xl font-bold font-mono-cyber" style={{ color: a.val }}>
          {value ?? "N/A"}
        </div>
      )}
      <div className="flex items-center justify-between">
        {subtitle && (
          <div className="text-[11px] font-mono-cyber" style={{ color: "#334155" }}>
            {subtitle}
          </div>
        )}
        {trend && trendValue && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono-cyber"
            style={
              trend === "up"
                ? { background: "rgba(16,185,129,0.1)", color: "#10b981" }
                : trend === "down"
                ? { background: "rgba(239,68,68,0.1)", color: "#ef4444" }
                : { background: "rgba(100,116,139,0.1)", color: "#64748b" }
            }
          >
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
