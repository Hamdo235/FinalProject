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
        <div className="flex items-center gap-2 rounded-md bg-white shadow-lg border px-3 py-2 hover:shadow-xl transition-shadow">
          <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-600" />
          </div>
          <div className="text-sm font-medium text-gray-800 group-hover:text-primary-700">Chatbot‑LLM</div>
        </div>
      </Link>
    </div>
  );
}
