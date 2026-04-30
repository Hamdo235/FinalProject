"use client";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SimpleChartProps } from "./SimpleChartInner";

const SimpleChartInner = dynamic(() => import("./SimpleChartInner"), {
  ssr: false,
  loading: ({ isLoading }) =>
    isLoading ? (
      <Card>
        <CardHeader><CardTitle>…</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    ) : null,
});

export default function SimpleChart(props: SimpleChartProps) {
  return <SimpleChartInner {...props} />;
}
