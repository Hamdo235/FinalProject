"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip simple basé sur title et CSS (fallback si Radix non dispo).
 * Pour une version complète, installer @radix-ui/react-tooltip et remplacer ce composant.
 */
export function Tooltip({ children, content, className }: {
  children: React.ReactNode;
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("group relative inline-block", className)}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}
