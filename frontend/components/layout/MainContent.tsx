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
          : "flex-1 p-4 md:p-6 lg:p-8 min-w-0 min-h-0 overflow-y-auto"
      }
    >
      <div className={isChat ? "w-full h-full" : "mx-auto max-w-7xl w-full h-full"}>{children}</div>
    </main>
  );
}
