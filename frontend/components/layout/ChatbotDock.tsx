"use client";
import Link from "next/link";
import { Bot, Zap } from "lucide-react";
import { usePathname } from "next/navigation";

export default function ChatbotDock() {
  const pathname = usePathname();
  if (pathname?.startsWith("/chat")) return null;
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link href="/chat">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-2.5 transition-all"
          style={{
            background: "rgba(12, 22, 40, 0.95)",
            border: "1px solid rgba(34,211,238,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.06)",
            backdropFilter: "blur(12px)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.55)";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 4px 32px rgba(0,0,0,0.6), 0 0 20px rgba(34,211,238,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.3)";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.06)";
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #22d3ee, #3b82f6)",
              boxShadow: "0 0 12px rgba(34,211,238,0.4)",
            }}
          >
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#67e8f9" }}>
            Assistant SOC
          </span>
          <Zap className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
        </div>
      </Link>
    </div>
  );
}
