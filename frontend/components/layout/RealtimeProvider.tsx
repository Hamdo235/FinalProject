"use client";
import React from "react";
import {
  createEventStream,
  fetchBlockedIps,
  fetchDefenseActions,
  fetchHealth,
} from "@/lib/api";
import type { Alert, BlockedIp, DefenseAction, HealthStatus } from "@/types/api";

// ─── Toast types ─────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "info" | "warn";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  createdAt: number;
}

// ─── Context shape ───────────────────────────────────────────────────────────
interface RealtimeContextValue {
  // Alerts SSE
  latestAlert: Alert | null;
  subscribeToAlerts: (cb: (a: Alert) => void) => () => void;
  sseConnected: boolean;

  // Pending defense actions (SSE-driven, with slow polling safety net)
  pendingActions: DefenseAction[];
  pendingCount: number;
  refreshPending: () => Promise<void>;

  // Currently blocked IPs (SSE-driven, slow safety polling)
  blockedIps: BlockedIp[];
  refreshBlocked: () => Promise<void>;

  // Health
  health: HealthStatus | null;
  healthOk: boolean;
  refreshHealth: () => Promise<void>;

  // Toast API
  toasts: ToastItem[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

const RealtimeContext = React.createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
  const ctx = React.useContext(RealtimeContext);
  if (!ctx) {
    // Fallback (no-op) — useful during SSR or if consumed outside provider
    return {
      latestAlert: null,
      subscribeToAlerts: () => () => undefined,
      sseConnected: false,
      pendingActions: [],
      pendingCount: 0,
      refreshPending: async () => undefined,
      blockedIps: [],
      refreshBlocked: async () => undefined,
      health: null,
      healthOk: false,
      refreshHealth: async () => undefined,
      toasts: [],
      pushToast: () => undefined,
      dismissToast: () => undefined,
    };
  }
  return ctx;
}

function isPendingHumanDecision(a: DefenseAction): boolean {
  if (!a.ip || a.revoked_at) return false;
  if (a.approved_by || a.approved_at) return false;
  return a.action === "review" || a.action === "block_temp";
}

// ─── Provider ────────────────────────────────────────────────────────────────
export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [latestAlert, setLatestAlert] = React.useState<Alert | null>(null);
  const [sseConnected, setSseConnected] = React.useState(false);
  const [pendingActions, setPendingActions] = React.useState<DefenseAction[]>([]);
  const [blockedIps, setBlockedIps] = React.useState<BlockedIp[]>([]);
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const listenersRef = React.useRef<Set<(a: Alert) => void>>(new Set());
  const toastIdRef = React.useRef(0);

  // ── Toast API ─────────────────────────────────────────────────────────────
  const dismissToast = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastTimersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const pushToast = React.useCallback((message: string, type: ToastType = "info") => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    const item: ToastItem = { id, message, type, createdAt: Date.now() };
    setToasts((prev) => [...prev, item]);
    const delay = type === "error" ? 6000 : 4000;
    const timer = setTimeout(() => {
      dismissToast(id);
      toastTimersRef.current.delete(timer);
    }, delay);
    toastTimersRef.current.add(timer);
  }, [dismissToast]);

  React.useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // ── Refreshers ────────────────────────────────────────────────────
  const refreshPending = React.useCallback(async () => {
    try {
      const all = await fetchDefenseActions({ limit: 200 });
      setPendingActions(all.filter(isPendingHumanDecision));
    } catch {
      // silent
    }
  }, []);

  const refreshBlocked = React.useCallback(async () => {
    try {
      const list = await fetchBlockedIps();
      setBlockedIps(list);
    } catch {
      setBlockedIps([]);
    }
  }, []);

  const refreshHealth = React.useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, []);

  // ── Single SSE connection ────────────────────────────────────────────
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = createEventStream({
        onAlert: (alert) => {
          setSseConnected(true);
          setLatestAlert(alert);
          listenersRef.current.forEach((cb) => {
            try {
              cb(alert);
            } catch (err) {
              console.warn("[Realtime] alert listener threw:", err);
            }
          });
        },
        onDefense: () => {
          // Defense action lifecycle changed server-side; resync local cache.
          refreshPending();
          refreshBlocked();
        },
        onOpen: () => setSseConnected(true),
        onError: () => setSseConnected(false),
      });
    } catch {
      setSseConnected(false);
    }
    return () => {
      if (es) es.close();
    };
  }, [refreshPending, refreshBlocked]);

  const subscribeToAlerts = React.useCallback((cb: (a: Alert) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  // ── Slow polling safety net (paused when tab hidden) ──────────────────────
  // SSE delivers real-time updates; polling exists only to recover from missed events
  // (e.g. transient SSE disconnections, server restarts, TTL expirations).
  React.useEffect(() => {
    let cancelled = false;
    const SLOW_INTERVAL = 30000; // 30s safety net

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      await Promise.allSettled([refreshPending(), refreshBlocked()]);
    };
    tick();
    const iv = setInterval(tick, SLOW_INTERVAL);

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      cancelled = true;
      clearInterval(iv);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [refreshPending, refreshBlocked]);

  React.useEffect(() => {
    refreshHealth();
    const iv = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refreshHealth();
    }, 15000);
    return () => clearInterval(iv);
  }, [refreshHealth]);

  const healthOk = React.useMemo(() => {
    if (!health) return false;
    // Backend is considered OK when /health returned 200 with status==='ok'.
    // 'degraded' means reachable but a sub-service (RAG/Ollama) is down.
    return health.status === "ok";
  }, [health]);

  const value: RealtimeContextValue = {
    latestAlert,
    subscribeToAlerts,
    sseConnected,
    pendingActions,
    pendingCount: pendingActions.length,
    refreshPending,
    blockedIps,
    refreshBlocked,
    health,
    healthOk,
    refreshHealth,
    toasts,
    pushToast,
    dismissToast,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
