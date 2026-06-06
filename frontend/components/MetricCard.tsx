import React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  accent?: "violet" | "cyan" | "amber" | "red" | "green" | "blue";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

const accentMap: Record<string, { top: string; iconBg: string; val: string }> = {
  violet: { top: "stat-sage",   iconBg: "bg-[#EBF3EE] border-[#B8D8C4]",  val: "text-accent-sage" },
  sage:   { top: "stat-sage",   iconBg: "bg-[#EBF3EE] border-[#B8D8C4]",  val: "text-accent-sage" },
  cyan:   { top: "stat-slate",  iconBg: "bg-[#EAF2F8] border-[#A8C8E0]",  val: "text-accent-slate" },
  slate:  { top: "stat-slate",  iconBg: "bg-[#EAF2F8] border-[#A8C8E0]",  val: "text-accent-slate" },
  amber:  { top: "stat-amber",  iconBg: "bg-[#FDF8E8] border-[#F0E090]",  val: "text-[#A07800]" },
  red:    { top: "stat-terra",  iconBg: "bg-[#FDF0E8] border-[#F0C4A8]",  val: "text-accent-terra" },
  terra:  { top: "stat-terra",  iconBg: "bg-[#FDF0E8] border-[#F0C4A8]",  val: "text-accent-terra" },
  green:  { top: "stat-sage",   iconBg: "bg-[#EBF3EE] border-[#B8D8C4]",  val: "text-accent-sage" },
  blue:   { top: "stat-slate",  iconBg: "bg-[#EAF2F8] border-[#A8C8E0]",  val: "text-accent-slate" },
};

export default function MetricCard({
  title, value, subtitle, loading, icon, accent = "violet", trend, trendValue,
}: MetricCardProps) {
  const a = accentMap[accent] ?? accentMap.violet;
  return (
    <div className={cn("cyber-card p-4 flex flex-col gap-3", a.top)}>
      <div className="flex items-center justify-between">
        <span className="text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary">
          {title}
        </span>
        {icon && (
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border", a.iconBg)}>
            {icon}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className={cn("text-2xl font-bold font-mono-cyber", a.val)}>
          {value ?? "N/A"}
        </div>
      )}

      <div className="flex items-center justify-between">
        {subtitle && (
          <div className="text-[11px] font-mono-cyber text-text-muted">
            {subtitle}
          </div>
        )}
        {trend && trendValue && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono-cyber",
            trend === "up"      ? "bg-accent-teal/10 text-accent-teal-bright"
            : trend === "down"  ? "bg-accent-red/10 text-accent-red"
            : "bg-text-muted/10 text-text-secondary",
          )}>
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
