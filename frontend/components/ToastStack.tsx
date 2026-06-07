"use client";
import React from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useRealtime } from "@/components/layout/RealtimeProvider";
import type { ToastType } from "@/components/layout/RealtimeProvider";

const STYLES: Record<ToastType, { color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  success: { color: "#6FB894", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)", Icon: CheckCircle  },
  error:   { color: "#D98862", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.35)",  Icon: AlertCircle  },
  info:    { color: "#6BA3C9", bg: "rgba(34,211,238,0.1)",  border: "rgba(34,211,238,0.3)",  Icon: Info         },
  warn:    { color: "#E8C547", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  Icon: AlertTriangle },
};

export default function ToastStack() {
  const { toasts, dismissToast } = useRealtime();
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 360 }}
    >
      {toasts.map((t) => {
        const s = STYLES[t.type];
        const Icon = s.Icon;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 animate-slide-in-right"
            style={{
              background: "#161B22",
              border: `1px solid ${s.border}`,
              boxShadow: `0 6px 28px rgba(0,0,0,0.5), 0 0 20px ${s.bg}`,
              minWidth: 280,
            }}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: s.color }} />
            <span
              className="flex-1 text-xs font-medium leading-relaxed"
              style={{ color: "#E6E9EF" }}
            >
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md p-0.5 transition-all"
              style={{ color: "#6B7280" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#E6E9EF";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#6B7280";
              }}
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
