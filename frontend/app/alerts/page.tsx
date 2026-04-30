"use client";
import { useEffect, useState } from "react";
import {
  fetchAlerts, labelAlert, createIncidentFromAlerts,
  approveDefenseAction, revokeDefenseAction,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { Alert } from "@/types/api";
import { CheckSquare, MapPin, MessageCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getActorLabel } from "@/lib/actor";
import { formatDateTimeLocal, formatTimeLocal } from "@/lib/time";
import { useRealtime } from "@/components/layout/RealtimeProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const SEV: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"  },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" },
  low:    { color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)"  },
};

function SevBadge({ s }: { s: string }) {
  const c = SEV[s] ?? { color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" };
  return (
    <span
      className="cyber-badge font-mono-cyber"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {s}
    </span>
  );
}

function ActionBtn({
  label, color, onClick, disabled,
}: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
      style={{ border: `1px solid ${color}35`, color, background: `${color}0a` }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}0a`; }}
    >
      {label}
    </button>
  );
}

export default function AlertsPage() {
  const actorLabel = useState(() => getActorLabel())[0];
  const { subscribeToAlerts, sseConnected, pushToast, refreshPending } = useRealtime();
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [live, setLive]               = useState(false);
  const [busy, setBusy]               = useState(false);
  const [labelBusy, setLabelBusy]     = useState<number | null>(null);
  const [bulkBusy, setBulkBusy]       = useState(false);
  const [defenseBusyId, setDefenseBusyId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(console.error);
  }, []);

  useEffect(() => {
    return subscribeToAlerts((a) => {
      setAlerts((p) => [a, ...p.filter((x) => x.id !== a.id)]);
      setLive(true);
    });
  }, [subscribeToAlerts]);

  useEffect(() => {
    if (sseConnected) setLive(true);
  }, [sseConnected]);

  const doLabel = async (id: number, label: "true_attack" | "false_positive") => {
    setLabelBusy(id);
    try {
      await labelAlert(id, label);
      pushToast(
        label === "true_attack"
          ? `Alerte #${id} marquée comme attaque`
          : `Alerte #${id} marquée comme faux positif`,
        "success"
      );
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur labellisation #${id} : ${em}`, "error");
    } finally { setLabelBusy(null); }
  };

  const updateDefense = (actionId: number, next: Alert["defense"]) =>
    setAlerts((p) => p.map((a) => (a.defense?.id === actionId ? { ...a, defense: next } : a)));

  const onApprove = async (id: number, ip?: string) => {
    setDefenseBusyId(id);
    try {
      const r = await approveDefenseAction(id, actorLabel);
      updateDefense(id, r.action);
      pushToast(`✅ IP ${ip ?? r.action.ip ?? "?"} bloquée par ${actorLabel}`, "success");
      refreshPending();
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur approbation : ${em}`, "error");
    } finally { setDefenseBusyId(null); }
  };

  const onRevoke = async (id: number, ip?: string) => {
    setDefenseBusyId(id);
    try {
      const r = await revokeDefenseAction(id);
      updateDefense(id, r.action);
      pushToast(`↩ Blocage de ${ip ?? r.action.ip ?? "?"} révoqué`, "info");
      refreshPending();
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur révocation : ${em}`, "error");
    } finally { setDefenseBusyId(null); }
  };

  const toggle = (id: number) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected((p) => p.size === alerts.length ? new Set() : new Set(alerts.map((a) => a.id)));

  const createIncident = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const r = await createIncidentFromAlerts(Array.from(selected));
      const rec = r as unknown as { id?: number; incident_id?: number };
      const id = rec.id ?? rec.incident_id ?? 1;
      pushToast(`Incident #${id} créé à partir de ${selected.size} alerte(s)`, "success");
      router.push(`/incidents/${id}`);
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur de création d'incident : ${em}`, "error");
    } finally { setBusy(false); }
  };

  const bulkDecision = async (label: "true_attack" | "false_positive") => {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      for (const id of Array.from(selected)) await labelAlert(id, label);
      pushToast(
        label === "true_attack"
          ? `${selected.size} alerte(s) confirmée(s) comme attaque`
          : `${selected.size} alerte(s) marquée(s) comme faux positif`,
        "success"
      );
      setSelected(new Set());
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur décision en masse : ${em}`, "error");
    } finally { setBulkBusy(false); }
  };

  const criticalCount = alerts.filter((a) => a.severity === "high").length;

  return (
    <main className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Alertes</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {alerts.length} alerte{alerts.length !== 1 ? "s" : ""} —{" "}
            <span style={{ color: "#ef4444" }}>{criticalCount} critique{criticalCount !== 1 ? "s" : ""}</span>
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 cyber-badge font-mono-cyber"
          style={
            live
              ? { background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }
              : { background: "rgba(100,116,139,0.08)", color: "#64748b", border: "1px solid rgba(100,116,139,0.15)" }
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: live ? "#10b981" : "#64748b" }}
          />
          {live ? "LIVE" : "OFF"}
        </span>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={createIncident}
          disabled={!selected.size || busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee", background: "rgba(34,211,238,0.07)" }}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Créer incident ({selected.size})
        </button>
        <button
          onClick={() => bulkDecision("true_attack")}
          disabled={!selected.size || bulkBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", background: "rgba(239,68,68,0.07)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Confirmer attaque
        </button>
        <button
          onClick={() => bulkDecision("false_positive")}
          disabled={!selected.size || bulkBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(100,116,139,0.2)", color: "#64748b", background: "rgba(100,116,139,0.06)" }}
        >
          Faux positif
        </button>
        <Link
          href="/dashboard#map"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{ border: "1px solid rgba(34,211,238,0.15)", color: "#67e8f9", background: "rgba(34,211,238,0.05)" }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Carte
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{ border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", background: "rgba(245,158,11,0.06)" }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat SOC
        </Link>
      </div>

      {/* ── Table ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(34,211,238,0.08)", background: "#0c1628" }}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={alerts.length > 0 && selected.size === alerts.length}
                  onChange={toggleAll}
                  style={{ accentColor: "#22d3ee" }}
                />
              </th>
              <th>Time</th>
              <th>Source</th>
              <th>IP</th>
              <th>Règle</th>
              <th>Sévérité</th>
              <th>Score</th>
              <th>Défense</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    style={{ accentColor: "#22d3ee" }}
                  />
                </td>
                <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                  {formatDateTimeLocal(a.ts)}
                </td>
                <td className="px-4 py-3 font-medium text-sm" style={{ color: "#e2e8f0" }}>
                  {a.source}
                </td>
                <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#22d3ee" }}>
                  {a.ip || "—"}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>
                  {a.rule || "—"}
                </td>
                <td className="px-4 py-3">
                  <SevBadge s={a.severity} />
                </td>
                <td className="px-4 py-3 font-mono-cyber text-xs font-bold" style={{ color: "#10b981" }}>
                  {a.score.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {a.defense ? (
                    <div className="space-y-1.5">
                      <span
                        className="cyber-badge font-mono-cyber text-[10px]"
                        style={
                          a.defense.action === "block_temp"
                            ? { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }
                            : { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }
                        }
                      >
                        {a.defense.action}
                      </span>
                      {a.defense.expires_at && (
                        <div className="text-[10px] font-mono-cyber" style={{ color: "#334155" }}>
                          exp. {formatTimeLocal(a.defense.expires_at!)}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {!a.defense.approved_by && !a.defense.revoked_at &&
                          (a.defense.action === "review" || a.defense.action === "block_temp") && (
                          <ActionBtn
                            label="Approuver"
                            color="#10b981"
                            disabled={defenseBusyId === a.defense.id}
                            onClick={() => onApprove(a.defense!.id, a.ip)}
                          />
                        )}
                        {a.defense.active && (
                          <ActionBtn
                            label="Révoquer"
                            color="#64748b"
                            disabled={defenseBusyId === a.defense.id}
                            onClick={() => onRevoke(a.defense!.id, a.ip)}
                          />
                        )}
                      </div>
                      {a.defense.approved_by && (
                        <div className="text-[9px] font-mono-cyber" style={{ color: "#10b981" }}>
                          ✓ {a.defense.approved_by}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: "#334155" }}>n/a</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <ActionBtn
                      label="Attaque"
                      color="#ef4444"
                      disabled={labelBusy === a.id}
                      onClick={() => doLabel(a.id, "true_attack")}
                    />
                    <ActionBtn
                      label="Faux pos."
                      color="#10b981"
                      disabled={labelBusy === a.id}
                      onClick={() => doLabel(a.id, "false_positive")}
                    />
                    {a.ip && (
                      <Link
                        href={`/dashboard?ip=${encodeURIComponent(a.ip)}#map`}
                        className="text-xs underline font-mono-cyber"
                        style={{ color: "#22d3ee" }}
                      >
                        Carte
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!alerts.length && (
          <EmptyState
            title="Aucune alerte"
            description="Lancez la démonstration pour générer du trafic synthétique et voir le pipeline IDS en action."
          >
            <Link href="/demo">
              <Button>Lancer la démo</Button>
            </Link>
          </EmptyState>
        )}
      </div>
    </main>
  );
}
