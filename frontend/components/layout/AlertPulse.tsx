"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRealtime } from "@/components/layout/RealtimeProvider";
import { AlertTriangle, MapPin, MessageCircle, ExternalLink, X } from "lucide-react";

export default function AlertPulse() {
  const pathname = usePathname();
  const { subscribeToAlerts } = useRealtime();
  const [toast, setToast] = React.useState<{
    id: number;
    severity?: string;
    ip?: string;
    ts?: string;
  } | null>(null);

  React.useEffect(() => {
    return subscribeToAlerts((newAlert) => {
      setToast({ id: newAlert.id, severity: newAlert.severity, ip: newAlert.ip, ts: newAlert.ts });
    });
  }, [subscribeToAlerts]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || pathname?.startsWith("/chat")) return null;

  const sev = toast.severity || "low";

  const sevStyle =
    sev === "high"
      ? { accent: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", label: "CRITIQUE" }
      : sev === "medium"
      ? { accent: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", label: "MOYEN" }
      : { accent: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", label: "FAIBLE" };

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-[340px] animate-alert-in">
      <div
        className="rounded-2xl p-4"
        style={{
          background: "#0c1628",
          border: `1px solid ${sevStyle.border}`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: sevStyle.bg, border: `1px solid ${sevStyle.border}` }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: sevStyle.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] uppercase tracking-wider font-bold font-mono-cyber mb-0.5 flex items-center gap-1.5"
              style={{ color: sevStyle.accent }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-danger"
                style={{ background: sevStyle.accent }}
              />
              Nouvelle alerte — {sevStyle.label}
            </div>
            <div className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>
              Alerte #{toast.id}
            </div>
            <div className="text-xs mt-0.5 font-mono-cyber" style={{ color: "#64748b" }}>
              {toast.ip ? `IP source : ${toast.ip}` : "IP inconnue"}
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 p-1 rounded-lg transition-all"
            style={{ color: "#64748b" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/alerts", icon: ExternalLink, label: "Alertes" },
            {
              href: toast.ip
                ? `/dashboard?ip=${encodeURIComponent(toast.ip)}#map`
                : "/dashboard#map",
              icon: MapPin,
              label: "Carte",
            },
            { href: "/chat", icon: MessageCircle, label: "Chat" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
              style={{
                background: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.15)",
                color: "#22d3ee",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.12)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.06)";
              }}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
