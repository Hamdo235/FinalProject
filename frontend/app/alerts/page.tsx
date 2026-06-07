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

const SEV_CLS: Record<string, string> = {
  high:   "bg-[#2A1A12] text-accent-terra border-[#4D3122]",
  medium: "bg-[#262017] text-[#E0B83A]    border-[#4A3F1C]",
  low:    "bg-[#15241C] text-accent-sage  border-[#2C4A39]",
};

function SevBadge({ s }: { s: string }) {
  const cls = SEV_CLS[s] ?? "bg-text-muted/10 text-text-secondary border-text-muted/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] font-mono border ${cls}`}>
      {s}
    </span>
  );
}

type BtnColor = "red" | "teal" | "muted";
const BTN_CLS: Record<BtnColor, string> = {
  red:   "border-[#4D3122] text-accent-terra bg-[#2A1A12] hover:bg-[#35241A]",
  teal:  "border-[#2C4A39] text-accent-sage  bg-[#15241C] hover:bg-[#1C3025]",
  muted: "border-bg-border text-text-secondary bg-bg-base hover:bg-bg-card",
};

function ActionBtn({
  label, color, onClick, disabled,
}: { label: string; color: BtnColor; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border disabled:opacity-40 ${BTN_CLS[color]}`}
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
          <h1 className="text-xl font-bold text-text-primary">Alertes</h1>
          <p className="text-sm mt-0.5 text-text-secondary">
            {alerts.length} alerte{alerts.length !== 1 ? "s" : ""} —{" "}
            <span className="text-accent-terra">{criticalCount} critique{criticalCount !== 1 ? "s" : ""}</span>
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] font-mono border ${
          live
            ? "bg-[#15241C] text-accent-sage border-[#2C4A39]"
            : "bg-bg-base text-text-muted border-bg-border"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-accent-sage animate-pulse" : "bg-text-muted"}`} />
          {live ? "LIVE" : "OFF"}
        </span>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2">
        <button onClick={createIncident} disabled={!selected.size || busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border disabled:opacity-40 border-[#2C4A39] text-accent-sage bg-[#15241C] hover:bg-[#1C3025]">
          <CheckSquare className="h-3.5 w-3.5" />Creer incident ({selected.size})
        </button>
        <button onClick={() => bulkDecision("true_attack")} disabled={!selected.size || bulkBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border disabled:opacity-40 border-[#4D3122] text-accent-terra bg-[#2A1A12] hover:bg-[#35241A]">
          <AlertTriangle className="h-3.5 w-3.5" />Confirmer attaque
        </button>
        <button onClick={() => bulkDecision("false_positive")} disabled={!selected.size || bulkBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border disabled:opacity-40 border-bg-border text-text-secondary bg-bg-base hover:bg-bg-card">
          Faux positif
        </button>
        <Link href="/dashboard#map"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border border-[#2A4357] text-accent-slate bg-[#13202C] hover:bg-[#1A2C3A]">
          <MapPin className="h-3.5 w-3.5" />Carte
        </Link>
        <Link href="/chat"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border border-[#4A3F1C] text-[#E0B83A] bg-[#262017] hover:bg-[#262017]">
          <MessageCircle className="h-3.5 w-3.5" />Chat SOC
        </Link>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden bg-bg-card border border-bg-border">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={alerts.length > 0 && selected.size === alerts.length}
                  onChange={toggleAll}
                  className="accent-accent-sage"
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
                    className="accent-accent-sage"
                  />
                </td>
                <td className="px-4 py-3 font-mono-cyber text-xs text-text-secondary">{formatDateTimeLocal(a.ts)}</td>
                <td className="px-4 py-3 font-medium text-sm text-text-primary">{a.source}</td>
                <td className="px-4 py-3 font-mono-cyber text-xs text-text-mono">{a.ip || "—"}</td>
                <td className="px-4 py-3 text-xs text-text-secondary">{a.rule || "—"}</td>
                <td className="px-4 py-3">
                  <SevBadge s={a.severity} />
                </td>
                <td className="px-4 py-3 font-mono-cyber text-xs font-bold text-accent-sage">{a.score.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {a.defense ? (
                    <div className="space-y-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide font-mono border ${
                        a.defense.action === "block_temp"
                          ? "bg-[#2A1A12] text-accent-terra border-[#4D3122]"
                          : "bg-[#262017] text-[#E0B83A] border-[#4A3F1C]"
                      }`}>
                        {a.defense.action}
                      </span>
                      {a.defense.expires_at && (
                        <div className="text-[10px] font-mono-cyber text-text-muted">
                          exp. {formatTimeLocal(a.defense.expires_at!)}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {!a.defense.approved_by && !a.defense.revoked_at &&
                          (a.defense.action === "review" || a.defense.action === "block_temp") && (
                          <ActionBtn label="Approuver" color="teal" disabled={defenseBusyId === a.defense.id} onClick={() => onApprove(a.defense!.id, a.ip)} />
                        )}
                        {a.defense.active && (
                          <ActionBtn label="Révoquer" color="muted" disabled={defenseBusyId === a.defense.id} onClick={() => onRevoke(a.defense!.id, a.ip)} />
                        )}
                      </div>
                      {a.defense.approved_by && (
                        <div className="text-[9px] font-mono-cyber text-accent-sage">✓ {a.defense.approved_by}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">n/a</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <ActionBtn label="Attaque"   color="red"  disabled={labelBusy === a.id} onClick={() => doLabel(a.id, "true_attack")} />
                    <ActionBtn label="Faux pos." color="teal" disabled={labelBusy === a.id} onClick={() => doLabel(a.id, "false_positive")} />
                    {a.ip && (
                      <Link
                        href={`/dashboard?ip=${encodeURIComponent(a.ip)}#map`}
                        className="text-xs underline font-mono-cyber text-accent-slate hover:text-[#5A93B9]"
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
