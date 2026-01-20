import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

/**
 * Carte KPI simple pour le Dashboard
 */
export default function MetricCard({
  title,
  value,
  subtitle,
  loading,
  icon,
  trend,
  trendValue,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-semibold">{value}</div>
        )}
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        {trend && trendValue && (
          <div className="text-xs mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                trend === "up"
                  ? "bg-success/10 text-success"
                  : trend === "down"
                  ? "bg-danger/10 text-danger"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
