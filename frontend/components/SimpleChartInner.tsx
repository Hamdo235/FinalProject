"use client";
import React from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export interface SimpleChartProps {
  title: string;
  data: Record<string, unknown>[];
  type?: "line" | "bar";
  xKey: string;
  yKey: string;
  color?: string;
  loading?: boolean;
  height?: number;
}

const BAR_COLORS = ["#D98862", "#6BA3C9", "#6FB894", "#E8C547", "#6BA3C9"];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#1C222B",
  border: "1px solid rgba(34,211,238,0.2)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#E6E9EF",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

const axisStyle = { fontSize: 11, fill: "#6B7280" };

export default function SimpleChartInner({
  title, data, type = "line", xKey, yKey,
  color = "#6BA3C9", loading, height = 250,
}: SimpleChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "line" ? (
            <LineChart data={data}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6BA3C9" />
                  <stop offset="100%" stopColor="#6BA3C9" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(34,211,238,0.15)" }} />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="url(#lineGrad)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#6BA3C9", strokeWidth: 0 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(34,211,238,0.04)" }} />
              <Bar dataKey={yKey} radius={[5, 5, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
