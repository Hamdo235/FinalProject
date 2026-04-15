"use client";
import React from "react";
import { AlertTriangle, ShieldOff, ShieldCheck, X, Terminal, Clock } from "lucide-react";
import { approveDefenseAction, revokeDefenseAction } from "@/lib/api";
import { Alert } from "@/types/api";

interface Notification {
  id: string;
  alert: Alert;
  startedAt: number;
  countdown: number;
  iptables?: string;
  approved?: boolean;
  rejected?: boolean;
  busy?: boolean;
}

const COUNTDOWN_SECONDS = 30;
const MAX_NOTIFS = 3;

function sevColor(s: string) {
  if (s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#10b981";
}

function NotifCard({
  notif,
  onApprove,
  onReject,
}: {
  notif: Notification;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const pct = Math.max(0, (notif.countdown / COUNTDOWN_SECONDS) * 100);
  const color = sevColor(notif.alert.severity);

  return (
    <div
      className="w-80 rounded-2xl overflow-hidden animate-slide-in-right"
      style={{
        background: "#0a1220",
        border: `1px solid ${notif.approved ? "rgba(16,185,129,0.5)" : notif.rejected ? "rgba(100,116,139,0.3)" : "rgba(239,68,68,0.5)"}`,
        boxShadow: notif.approved
          ? "0 0 30px rgba(16,185,129,0.15)"
          : `0 0 30px rgba(239,68,68,0.15)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          background: notif.approved
            ? "rgba(16,185,129,0.1)"
            : "rgba(239,68,68,0.08)",
          borderBottom: `1px solid ${notif.approved ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}
      >
        {notif.approved ? (
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#10b981" }} />
        ) : notif.rejected ? (
          <ShieldOff className="h-4 w-4 shrink-0" style={{ color: "#64748b" }} />
        ) : (
          <AlertTriangle
            className="h-4 w-4 shrink-0 animate-pulse"
            style={{ color: "#ef4444" }}
          />
        )}
        <span
          className="text-xs font-bold font-mono-cyber tracking-wide flex-1"
          style={{
            color: notif.approved ? "#10b981" : notif.rejected ? "#64748b" : "#ef4444",
          }}
        >
          {notif.approved
            ? "✅ BLOCAGE ACTIF"
            : notif.rejected
            ? "❌ REJETÉ"
            : "⚠ MENACE DÉTECTÉE — BLOCAGE RECOMMANDÉ"}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-cyber" style={{ color: "#64748b" }}>
            IP SOURCE
          </span>
          <span
            className="text-xs font-bold font-mono-cyber"
            style={{ color: "#22d3ee" }}
          >
            {notif.alert.ip || "N/A"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono-cyber" style={{ color: "#64748b" }}>
              RÈGLE
            </span>
            <span className="text-[11px]" style={{ color: "#94a3b8" }}>
              {notif.alert.rule || notif.alert.source}
            </span>
          </div>
          <span
            className="text-[10px] font-bold font-mono-cyber px-2 py-0.5 rounded-full"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}30`,
              color,
            }}
          >
            {notif.alert.severity.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-cyber" style={{ color: "#64748b" }}>
            SCORE ML
          </span>
          <span
            className="text-xs font-bold font-mono-cyber"
            style={{ color: notif.alert.score >= 0.8 ? "#ef4444" : "#f59e0b" }}
          >
            {(notif.alert.score * 10).toFixed(1)}/10
          </span>
        </div>

        {/* Countdown */}
        {!notif.approved && !notif.rejected && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" style={{ color: "#f59e0b" }} />
                <span className="text-[10px] font-mono-cyber" style={{ color: "#f59e0b" }}>
                  Délai analyste
                </span>
              </div>
              <span
                className="text-[11px] font-bold font-mono-cyber"
                style={{ color: notif.countdown <= 10 ? "#ef4444" : "#f59e0b" }}
              >
                {notif.countdown}s
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(239,68,68,0.1)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background:
                    notif.countdown > 15
                      ? "linear-gradient(90deg,#f59e0b,#ef4444)"
                      : "linear-gradient(90deg,#ef4444,#dc2626)",
                }}
              />
            </div>
            <p className="text-[9px] mt-1 font-mono-cyber" style={{ color: "#334155" }}>
              Aucune action automatique — décision humaine requise
            </p>
          </div>
        )}

        {/* iptables command after approve */}
        {notif.approved && notif.iptables && (
          <div
            className="rounded-lg px-3 py-2 font-mono-cyber text-[10px] flex items-start gap-2"
            style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <Terminal className="h-3 w-3 shrink-0 mt-0.5" style={{ color: "#10b981" }} />
            <span style={{ color: "#34d399" }}>{notif.iptables}</span>
          </div>
        )}

        {/* Action buttons */}
        {!notif.approved && !notif.rejected && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApprove(notif.id)}
              disabled={notif.busy}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                color: "#10b981",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.22)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.12)";
              }}
            >
              {notif.busy ? "…" : "✅ APPROUVER"}
            </button>
            <button
              onClick={() => onReject(notif.id)}
              disabled={notif.busy}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{
                background: "rgba(100,116,139,0.08)",
                border: "1px solid rgba(100,116,139,0.2)",
                color: "#64748b",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(100,116,139,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(100,116,139,0.08)";
              }}
            >
              ❌ REJETER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface BlockingNotificationProps {
  newAlert: Alert | null;
}

export default function BlockingNotification({ newAlert }: BlockingNotificationProps) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const seenIds = React.useRef<Set<number>>(new Set());
  const notifsRef = React.useRef<Notification[]>([]);
  notifsRef.current = notifications;

  React.useEffect(() => {
    if (!newAlert) return;
    if (seenIds.current.has(newAlert.id)) return;
    if (newAlert.severity === "low") return;
    const def = newAlert.defense;
    if (!def || (def.action !== "block_temp" && def.action !== "review")) return;

    seenIds.current.add(newAlert.id);
    setNotifications((prev) => {
      if (prev.length >= MAX_NOTIFS) return prev;
      const n: Notification = {
        id: `${newAlert.id}-${Date.now()}`,
        alert: newAlert,
        startedAt: Date.now(),
        countdown: COUNTDOWN_SECONDS,
      };
      return [n, ...prev];
    });
  }, [newAlert]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNotifications((prev) => {
        const updated = prev.map((n) => {
          if (n.approved || n.rejected) return n;
          const elapsed = Math.floor((Date.now() - n.startedAt) / 1000);
          const countdown = Math.max(0, COUNTDOWN_SECONDS - elapsed);
          return { ...n, countdown };
        });
        // Auto-reject notifications where countdown reached 0 more than 2s ago
        return updated.map((n) => {
          if (!n.approved && !n.rejected && n.countdown === 0) {
            const overdue = (Date.now() - n.startedAt) / 1000 - COUNTDOWN_SECONDS;
            if (overdue >= 2) return { ...n, rejected: true };
          }
          return n;
        });
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleApprove = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, busy: true } : n))
    );
    const notif = notifsRef.current.find((n) => n.id === id);
    if (!notif) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false } : n)));
      return;
    }
    const defId = notif.alert.defense?.id;
    if (!defId) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false } : n)));
      return;
    }
    try {
      const res = await approveDefenseAction(defId, "Analyste SOC");
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, busy: false, approved: true, iptables: res.iptables_command ?? undefined }
            : n
        )
      );
      setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 8000);
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false } : n)));
    }
  }, []);

  const handleReject = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, busy: true } : n))
    );
    const notif = notifsRef.current.find((n) => n.id === id);
    const defId = notif?.alert.defense?.id;
    if (defId) {
      try { await revokeDefenseAction(defId); } catch {}
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, busy: false, rejected: true } : n))
    );
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  }, []);

  const handleDismiss = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
      style={{ maxWidth: "320px" }}
    >
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto relative">
          <button
            onClick={() => handleDismiss(n.id)}
            className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full flex items-center justify-center transition-all"
            style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X className="h-2.5 w-2.5" style={{ color: "#64748b" }} />
          </button>
          <NotifCard notif={n} onApprove={handleApprove} onReject={handleReject} />
        </div>
      ))}
    </div>
  );
}
