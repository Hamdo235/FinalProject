"use client";
import React from "react";
import { AlertTriangle, ShieldOff, ShieldCheck, X, Terminal, Clock } from "lucide-react";
import { approveDefenseAction, revokeDefenseAction, autoDecideAction } from "@/lib/api";
import { getActorLabel } from "@/lib/actor";
import { Alert, DefenseAction } from "@/types/api";
import { useRealtime } from "@/components/layout/RealtimeProvider";

interface Notification {
  id: string;
  alert: Alert;
  defenseActionId: number;
  startedAt: number;
  countdown: number;
  iptables?: string;
  error?: string;
  approved?: boolean;
  rejected?: boolean;
  busy?: boolean;
  autoDeciding?: boolean;
  llmReasoning?: string;
  llmDecision?: 'block' | 'allow';
}

const COUNTDOWN_SECONDS = 30;
const MAX_NOTIFS = 3;

function actionToAlert(action: DefenseAction): Alert {
  const confidence = Number.isFinite(action.confidence) ? action.confidence : 0;
  const severity: Alert["severity"] =
    confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
  return {
    id: action.alert_id ?? action.id,
    ts: action.created_at || new Date().toISOString(),
    source: "Moteur de défense",
    ip: action.ip || undefined,
    rule: action.reason || "needs_review",
    severity,
    score: confidence,
    status: "pending_review",
    defense: action,
  };
}

function sevColor(s: string) {
  if (s === "high") return "#D98862";
  if (s === "medium") return "#E0B83A";
  return "#6FB894";
}
function sevBg(s: string) {
  if (s === "high") return "#2A1A12";
  if (s === "medium") return "#262017";
  return "#15241C";
}
function sevBorder(s: string) {
  if (s === "high") return "#4D3122";
  if (s === "medium") return "#4A3F1C";
  return "#2C4A39";
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

  const borderColor = notif.approved ? "#2C4A39" : notif.rejected ? "#262D38" : "#D98862";
  const headerBg   = notif.approved ? "#15241C" : notif.rejected ? "#1C222B" : "#2A1A12";
  const headerText = notif.approved ? "#6FB894" : notif.rejected ? "#6B7280" : "#D98862";

  return (
    <div
      className="w-80 rounded-2xl overflow-hidden animate-slide-in-right bg-bg-card"
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}
      >
        {notif.approved ? (
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#6FB894" }} />
        ) : notif.rejected ? (
          <ShieldOff className="h-4 w-4 shrink-0" style={{ color: "#6B7280" }} />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" style={{ color: "#D98862" }} />
        )}
        <span className="text-xs font-bold font-mono-cyber tracking-wide flex-1" style={{ color: headerText }}>
          {notif.approved
            ? "BLOCAGE ACTIF"
            : notif.rejected
            ? "REJETÉ"
            : "MENACE DÉTECTÉE — BLOCAGE RECOMMANDÉ"}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-cyber text-text-muted">IP SOURCE</span>
          <span className="text-sm font-bold font-mono text-text-primary">
            {notif.alert.ip || "N/A"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono-cyber text-text-muted">RÈGLE</span>
            <span className="text-[11px] text-text-secondary">
              {notif.alert.rule || notif.alert.source}
            </span>
          </div>
          <span
            className="text-[10px] font-bold font-mono-cyber px-2 py-0.5 rounded-full"
            style={{
              background: sevBg(notif.alert.severity),
              border: `1px solid ${sevBorder(notif.alert.severity)}`,
              color,
            }}
          >
            {notif.alert.severity.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-cyber text-text-muted">SCORE ML</span>
          <span
            className="text-xs font-bold font-mono-cyber"
            style={{ color: notif.alert.score >= 0.8 ? "#D98862" : "#E0B83A" }}
          >
            {(notif.alert.score * 10).toFixed(1)}/10
          </span>
        </div>

        {/* Countdown / LLM reasoning */}
        {!notif.approved && !notif.rejected && !notif.autoDeciding && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#E0B83A]" />
                <span className="text-[10px] font-mono-cyber text-[#E0B83A]">Délai analyste</span>
              </div>
              <span
                className="text-[11px] font-bold font-mono-cyber"
                style={{ color: notif.countdown <= 10 ? "#D98862" : "#E0B83A" }}
              >
                {notif.countdown}s
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-[#1E242E]">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background: notif.countdown > 15
                    ? "linear-gradient(90deg,#E8C547,#D98862)"
                    : "linear-gradient(90deg,#D98862,#B86848)",
                }}
              />
            </div>
            <p className="text-[9px] mt-1 font-mono-cyber text-text-muted">
              {notif.countdown > 0
                ? "Aucune réponse → le LLM décidera automatiquement"
                : "Transfert au LLM SOC IA…"}
            </p>
          </div>
        )}

        {/* LLM en cours de décision */}
        {notif.autoDeciding && (
          <div className="pt-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-[#6FB894] border-t-transparent animate-spin" />
              <span className="text-[10px] font-mono-cyber text-[#6FB894]">LLM SOC IA en cours d'analyse…</span>
            </div>
            <p className="text-[9px] font-mono-cyber text-text-muted pl-5">
              Consultation du modèle de langage…
            </p>
          </div>
        )}

        {/* Raisonnement LLM après décision */}
        {(notif.approved || notif.rejected) && notif.llmReasoning && (
          <div
            className="rounded-lg px-3 py-2 text-[9px] font-mono-cyber mt-1"
            style={{
              background: notif.llmDecision === 'block' ? '#15241C' : '#1C222B',
              border: `1px solid ${notif.llmDecision === 'block' ? '#2C4A39' : '#262D38'}`,
              color: notif.llmDecision === 'block' ? '#7FB89A' : '#9BA3AF',
            }}
          >
            🤖 <span className="font-bold">LLM SOC IA :</span> {notif.llmReasoning}
          </div>
        )}

        {/* iptables command after approve */}
        {notif.approved && notif.iptables && (
          <div className="rounded-lg px-3 py-2 font-mono-cyber text-[10px] flex items-start gap-2 bg-[#15241C] border border-[#2C4A39]">
            <Terminal className="h-3 w-3 shrink-0 mt-0.5 text-accent-sage" />
            <span className="text-[#7FB89A]">{notif.iptables}</span>
          </div>
        )}

        {/* Action buttons */}
        {!notif.approved && !notif.rejected && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApprove(notif.id)}
              disabled={notif.busy}
              className="flex-1 py-2 rounded-[10px] text-xs font-bold transition-all disabled:opacity-50 bg-accent-sage text-white hover:bg-[#5CA37F] active:scale-[0.98]"
            >
              {notif.busy ? "…" : "✓ APPROUVER"}
            </button>
            <button
              onClick={() => onReject(notif.id)}
              disabled={notif.busy}
              className="flex-1 py-2 rounded-[10px] text-xs font-bold transition-all disabled:opacity-50 bg-bg-card border-[1.5px] border-[#D98862] text-[#D98862] hover:bg-[#2A1A12] active:scale-[0.98]"
            >
              ✕ REJETER
            </button>
          </div>
        )}

        {notif.error && (
          <div className="rounded-lg px-3 py-2 font-mono-cyber text-[10px] bg-[#2A1A12] border border-[#4D3122] text-[#D98862]">
            {notif.error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockingNotification() {
  const actorLabel = React.useMemo(() => getActorLabel(), []);
  const { latestAlert, pendingActions, pushToast, refreshPending } = useRealtime();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const seenDefenseIds = React.useRef<Set<number>>(new Set());
  const initializedFromSnapshot = React.useRef(false);
  const notifsRef = React.useRef<Notification[]>([]);
  notifsRef.current = notifications;
  const dismissTimersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const handleAutoDecide = React.useCallback(async (id: string) => {
    const notif = notifsRef.current.find((n) => n.id === id);
    if (!notif || notif.approved || notif.rejected || notif.autoDeciding) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, autoDeciding: true } : n))
    );
    try {
      const res = await autoDecideAction(notif.defenseActionId);
      if (res.decision === 'block') {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, autoDeciding: false, approved: true, llmDecision: 'block',
                  llmReasoning: res.reasoning, iptables: res.iptables_command ?? undefined }
              : n
          )
        );
        pushToast(`🤖 LLM SOC : IP ${notif.alert.ip ?? '?'} bloquée automatiquement`, 'success');
      } else {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, autoDeciding: false, rejected: true, llmDecision: 'allow',
                  llmReasoning: res.reasoning }
              : n
          )
        );
        pushToast(`🤖 LLM SOC : IP ${notif.alert.ip ?? '?'} autorisée (faible risque)`, 'info');
      }
      refreshPending();
      scheduleDismissRef.current(id, 10000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, autoDeciding: false, error: `LLM: ${msg}` } : n))
      );
    }
  }, [pushToast, refreshPending]);

  const scheduleDismiss = React.useCallback((id: string, delay: number) => {
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      dismissTimersRef.current.delete(timer);
    }, delay);
    dismissTimersRef.current.add(timer);
  }, []);

  const scheduleDismissRef = React.useRef(scheduleDismiss);
  scheduleDismissRef.current = scheduleDismiss;

  React.useEffect(() => {
    const timers = dismissTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const pushFromAction = React.useCallback((action: DefenseAction) => {
    if (!action.id) return;
    if (seenDefenseIds.current.has(action.id)) return;
    seenDefenseIds.current.add(action.id);
    const alert = actionToAlert(action);
    setNotifications((prev) => {
      if (prev.some((n) => n.defenseActionId === action.id)) return prev;
      if (prev.length >= MAX_NOTIFS) return prev;
      const n: Notification = {
        id: `def-${action.id}-${Date.now()}`,
        alert,
        defenseActionId: action.id,
        startedAt: Date.now(),
        countdown: COUNTDOWN_SECONDS,
      };
      return [n, ...prev];
    });
  }, []);

  // React to live SSE alerts that carry a fresh pending defense action
  React.useEffect(() => {
    if (!latestAlert?.defense) return;
    const def = latestAlert.defense;
    if (!def.ip || def.revoked_at) return;
    if (def.approved_by || def.approved_at) return;
    if (def.action !== "review" && def.action !== "block_temp") return;
    pushFromAction(def);
  }, [latestAlert, pushFromAction]);

  // React to centralized pendingActions snapshot (replaces local polling)
  React.useEffect(() => {
    const pendingIds = new Set(pendingActions.map((a) => a.id));
    setNotifications((prev) =>
      prev.filter((n) => n.approved || n.rejected || pendingIds.has(n.defenseActionId))
    );

    if (!initializedFromSnapshot.current) {
      pendingActions.forEach((action) => {
        if (action.id) seenDefenseIds.current.add(action.id);
      });
      initializedFromSnapshot.current = true;
      return;
    }

    for (const action of pendingActions) pushFromAction(action);
  }, [pendingActions, pushFromAction]);

  const handleAutoDecideRef = React.useRef(handleAutoDecide);
  handleAutoDecideRef.current = handleAutoDecide;

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.approved || n.rejected || n.autoDeciding) return n;
          const elapsed = Math.floor((Date.now() - n.startedAt) / 1000);
          const countdown = Math.max(0, COUNTDOWN_SECONDS - elapsed);
          if (countdown === 0 && !n.autoDeciding) {
            setTimeout(() => handleAutoDecideRef.current(n.id), 0);
          }
          return { ...n, countdown };
        })
      );
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
    const defId = notif.defenseActionId;
    if (!defId) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false } : n)));
      return;
    }
    try {
      const res = await approveDefenseAction(defId, actorLabel);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, busy: false, approved: true, error: undefined, iptables: res.iptables_command ?? undefined }
            : n
        )
      );
      pushToast(`✅ IP ${notif.alert.ip ?? "?"} bloquée par ${actorLabel}`, "success");
      refreshPending();
      scheduleDismiss(id, 8000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false, error: msg } : n)));
      pushToast(`❌ Erreur d'approbation : ${msg}`, "error");
    }
  }, [actorLabel, pushToast, refreshPending, scheduleDismiss, setNotifications]);

  const handleReject = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, busy: true } : n))
    );
    const notif = notifsRef.current.find((n) => n.id === id);
    const defId = notif?.defenseActionId;
    if (defId) {
      try { await revokeDefenseAction(defId); }
      catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, busy: false, error: msg } : n)));
        pushToast(`❌ Erreur de révocation : ${msg}`, "error");
        return;
      }
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, busy: false, error: undefined, rejected: true } : n))
    );
    if (notif?.alert.ip) {
      pushToast(`↩ Action sur ${notif.alert.ip} rejetée`, "info");
    }
    refreshPending();
    scheduleDismiss(id, 3000);
  }, [pushToast, refreshPending, scheduleDismiss]);

  const handleDismiss = React.useCallback((id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  , []);

  // Keyboard shortcut: Esc dismisses the most recent (top) active notification
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const list = notifsRef.current;
      if (list.length === 0) return;
      const target = list.find((n) => !n.busy) ?? list[0];
      if (target) handleDismiss(target.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDismiss]);

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
            className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full flex items-center justify-center transition-all bg-bg-card border border-[#262D38] shadow-sm hover:border-[#D98862] hover:text-[#D98862] text-text-muted"
          >
            <X className="h-2.5 w-2.5" />
          </button>
          <NotifCard notif={n} onApprove={handleApprove} onReject={handleReject} />
        </div>
      ))}
    </div>
  );
}
