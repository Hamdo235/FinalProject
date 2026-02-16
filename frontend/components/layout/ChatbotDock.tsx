"use client";
import React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { usePathname } from "next/navigation";

// Chatbot docké en bas: petit bouton qui ouvre /chat en plein écran.
export default function ChatbotDock() {
  const pathname = usePathname(); 
  if (pathname && pathname.startsWith("/chat")) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Link href="/chat" className="group">
        <div className="flex items-center gap-3 rounded-full bg-slate-900 text-white shadow-lg border border-slate-900/30 px-4 py-2 hover:shadow-xl transition-shadow">
          <div className="w-7 h-7 rounded-full bg-emerald-400/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-emerald-200" />
          </div>
          <div className="text-sm font-medium">Assistant SOC</div>
        </div>
      </Link>
    </div>
  );
}
