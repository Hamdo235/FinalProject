import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl", className)}
      style={{ background: "rgba(34,211,238,0.06)", ...style }}
      {...props}
    />
  );
}
