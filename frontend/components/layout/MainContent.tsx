"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat");

  return (
    <main
      className={
        isChat
          ? "flex-1 min-w-0 min-h-0 overflow-hidden"
          : "flex-1 p-5 md:p-8 lg:p-10 min-w-0 min-h-0 overflow-y-auto"
      }
    >
      <div className={isChat ? "w-full h-full" : "mx-auto max-w-7xl w-full h-full"}>
        {!isChat && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CyberSentinel LLM</div>
              <div className="text-2xl font-semibold font-display text-slate-900">Centre de commandement</div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Flux temps réel actif
            </div>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
