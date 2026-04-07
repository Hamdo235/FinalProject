"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat") ?? false;

  return (
    <main
      className={
        isChat
          ? "flex-1 min-w-0 min-h-0 overflow-hidden"
          : "flex-1 p-5 md:p-7 lg:p-8 min-w-0 min-h-0 overflow-y-auto"
      }
      style={{ background: "#080f1a" }}
    >
      <div className={isChat ? "w-full h-full" : "mx-auto max-w-7xl w-full h-full"}>
        {!isChat && (
          <div className="mb-7 flex items-center justify-between">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.22em] font-semibold font-mono-cyber mb-1"
                style={{ color: "#334155" }}
              >
                CyberSentinel LLM
              </div>
              <div className="text-2xl font-bold gradient-text-teal">
                Centre de commandement
              </div>
            </div>
            <div
              className="hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-mono-cyber"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10b981",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-badge"
                style={{ background: "#10b981" }}
              />
              Flux temps réel actif
            </div>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
