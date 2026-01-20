import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * État vide pédagogique pour listes/tableaux
 */
export function EmptyState({ className, title, description, children }: {
  className?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="text-gray-400 mb-4">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
