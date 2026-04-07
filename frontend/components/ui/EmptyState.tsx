import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ className, title, description, children }: {
  className?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-14 text-center", className)}>
      <div
        className="mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(34,211,238,0.07)",
          border: "1px solid rgba(34,211,238,0.15)",
        }}
      >
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#22d3ee" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>{title}</h3>
      {description && (
        <p className="text-sm mt-1.5 max-w-xs" style={{ color: "#64748b" }}>{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
