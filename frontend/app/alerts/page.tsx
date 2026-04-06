"use client";
import { useEffect, useState } from "react";
import {
  fetchAlerts,
  labelAlert,
  createIncidentFromAlerts,
  createAlertsSSE,
  approveDefenseAction,
  revokeDefenseAction,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { Alert } from "@/types/api";

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: "#ff4757", bg: "rgba(255,71,87,0.12)",  border: "rgba(255,71,87,0.3)"  },
  medium: { color: "#ffa502", bg: "rgba(255,165,2,0.12)",  border: "rgba(255,165,2,0.3)"  },
  low:    { color: "#00ff88", bg: "rgba(0,255,136,0.10)",  border: "rgba(0,255,136,0.25)" },
};

function SevBadge({ severity }: { severity: string }) {
  const s = SEV_STYLE[severity] ?? { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)" };
  return (
    <span
      className="cyber-badge font-mono-cyber"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {severity}
    </span>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
  disabled,
}: {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-0.5 rounded text-xs transition-all disabled:opacity-40"
      style={{
        border: `1px solid ${color}50`,
        color,
        background: `${color}0d`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}20`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}0d`; }}
    >
      {label}
    </button>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [labelBusy, setLabelBusy] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string>("");
  const [defenseBusyId, setDefenseBusyId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(console.error);
    const es = createAlertsSSE((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setLive(true);
    });
    return () => es.close();
  }, []);

  const doLabel = async (alertId: number, label: "true_attack" | "false_positive") => {
    setLabelBusy(alertId);
    setMsg("");
    try {
      await labelAlert(alertId, label);
      setMsg(`Alerte #${alertId} labellisée : ${label}.`);
    } catch (e) {
      setMsg(`Erreur labellisation alerte #${alertId}.`);
    } finally {
      setLabelBusy(null);
    }
  };

  const updateDefenseOnAlert = (actionId: number, nextDefense: Alert["defense"]) => {
    setAlerts((prev) =>
      prev.map((a) => (a.defense?.id === actionId ? { ...a, defense: nextDefense } : a))
    );
  };

  const onApproveDefense = async (actionId: number) => {
    setDefenseBusyId(actionId);
    try {
      const res = await approveDefenseAction(actionId);
      updateDefenseOnAlert(actionId, res.action);
      setMsg(`Action défense #${actionId} approuvée.`);
    } catch {
      setMsg(`Erreur approbation action défense #${actionId}.`);
    } finally {
      setDefenseBusyId(null);
    }
  };

  const onRevokeDefense = async (actionId: number) => {
    setDefenseBusyId(actionId);
    try {
      const res = await revokeDefenseAction(actionId);
      updateDefenseOnAlert(actionId, res.action);
      setMsg(`Action défense #${actionId} révoquée.`);
    } catch {
      setMsg(`Erreur révocation action défense #${actionId}.`);
    } finally {
      setDefenseBusyId(null);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createIncident = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await createIncidentFromAlerts(ids);
      const incId = (res as any).id || (res as any).incident_id || 1;
      setMsg(`Incident #${incId} créé.`);
      router.push(`/incidents/${incId}`);
    } finally {
      setBusy(false);
    }
  };

  const applyBulkDecision = async (label: "true_attack" | "false_positive") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkMsg("");
    try {
      for (const id of ids) await labelAlert(id, label);
      setBulkMsg(label === "true_attack" ? "Décision : attaque confirmée." : "Décision : faux positif.");
    } catch {
      setBulkMsg("Erreur lors de la décision en masse.");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold" style={{ color: "#e2e8f0" }}>
          Alertes
        </h1>
        <span
          className="text-xs px-2.5 py-0.5 rounded-full font-semibold font-mono-cyber"
          style={
            live
              ? { background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.35)" }
              : { background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.25)" }
          }
        >
          {live ? "● LIVE" : "○ OFF"}
        </span>
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={createIncident}
          disabled={selected.size === 0 || busy}
          className="px-3 py-1.5 rounded text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: selected.size > 0 ? "rgba(0,212,255,0.15)" : "rgba(100,116,139,0.1)",
            color: selected.size > 0 ? "#00d4ff" : "#64748b",
            border: `1px solid ${selected.size > 0 ? "rgba(0,212,255,0.35)" : "rgba(100,116,139,0.2)"}`,
          }}
        >
          {busy ? "..." : `Créer incident (${selected.size})`}
        </button>
        <button
          onClick={() => applyBulkDecision("true_attack")}
          disabled={selected.size === 0 || bulkBusy}
          className="px-3 py-1.5 rounded text-sm transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(255,71,87,0.3)", color: "#ff4757", background: "rgba(255,71,87,0.08)" }}
        >
          Confirmer attaque
        </button>
        <button
          onClick={() => applyBulkDecision("false_positive")}
          disabled={selected.size === 0 || bulkBusy}
          className="px-3 py-1.5 rounded text-sm transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(100,116,139,0.3)", color: "#64748b", background: "rgba(100,116,139,0.08)" }}
        >
          Faux positif
        </button>
        <a
          href="/dashboard#map"
          className="px-3 py-1.5 rounded text-sm transition-all"
          style={{ border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff", background: "rgba(0,212,255,0.06)" }}
        >
          Voir sur la carte
        </a>
        <a
          href="/chat"
          className="px-3 py-1.5 rounded text-sm transition-all"
          style={{ border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff", background: "rgba(0,212,255,0.06)" }}
        >
          Ouvrir le chatbot
        </a>
      </div>

      {/* Messages */}
      {msg     && <div className="text-sm" style={{ color: "#00ff88" }}>{msg}</div>}
      {bulkMsg && <div className="text-sm" style={{ color: "#00d4ff" }}>{bulkMsg}</div>}

      {/* Tableau */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(0,212,255,0.12)", background: "#0f1629" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.12)", background: "rgba(0,212,255,0.04)" }}>
              {["Sel", "Time", "Source", "IP", "Rule", "Severity", "Score", "Défense", "Label"].map((h) => (
                <th
                  key={h}
                  className="py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider font-mono-cyber"
                  style={{ color: "#64748b" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, idx) => (
              <tr
                key={a.id}
                className="transition-all"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: idx % 2 === 0 ? "transparent" : "rgba(0,212,255,0.02)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "transparent" : "rgba(0,212,255,0.02)"; }}
              >
                <td className="py-3 px-3">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="rounded"
                    style={{ accentColor: "#00d4ff" }}
                  />
                </td>
                <td className="py-3 px-3 font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                  {new Date(a.ts).toLocaleString()}
                </td>
                <td className="py-3 px-3" style={{ color: "#e2e8f0" }}>{a.source}</td>
                <td className="py-3 px-3 font-mono-cyber text-xs" style={{ color: "#00d4ff" }}>{a.ip}</td>
                <td className="py-3 px-3 text-xs" style={{ color: "#64748b" }}>{a.rule}</td>
                <td className="py-3 px-3">
                  <SevBadge severity={a.severity} />
                </td>
                <td className="py-3 px-3 font-mono-cyber text-xs" style={{ color: "#00ff88" }}>
                  {a.score.toFixed(2)}
                </td>
                <td className="py-3 px-3">
                  {a.defense ? (
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span
                          className="px-2 py-0.5 rounded font-mono-cyber"
                          style={
                            a.defense.action === "block_temp"
                              ? a.defense.active
                                ? { background: "rgba(255,71,87,0.15)", color: "#ff4757", border: "1px solid rgba(255,71,87,0.3)" }
                                : { background: "rgba(255,165,2,0.15)", color: "#ffa502", border: "1px solid rgba(255,165,2,0.3)" }
                              : a.defense.action === "review"
                              ? { background: "rgba(255,165,2,0.15)", color: "#ffa502", border: "1px solid rgba(255,165,2,0.3)" }
                              : { background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.2)" }
                          }
                        >
                          {a.defense.action}
                        </span>
                      </div>
                      {a.defense.reason && (
                        <div className="text-[11px]" style={{ color: "#64748b" }}>{a.defense.reason}</div>
                      )}
                      {a.defense.expires_at && (
                        <div className="text-[11px] font-mono-cyber" style={{ color: "#64748b" }}>
                          jusqu'à {new Date(a.defense.expires_at).toLocaleTimeString()}
                        </div>
                      )}
                      <div className="flex gap-1">
                        {a.defense.action === "review" && (
                          <ActionBtn
                            label="Approve"
                            color="#00ff88"
                            disabled={defenseBusyId === a.defense.id}
                            onClick={() => onApproveDefense(a.defense!.id)}
                          />
                        )}
                        {a.defense.active && (
                          <ActionBtn
                            label="Revoke"
                            color="#64748b"
                            disabled={defenseBusyId === a.defense.id}
                            onClick={() => onRevokeDefense(a.defense!.id)}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: "#64748b" }}>n/a</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <ActionBtn
                      label="Attaque"
                      color="#ff4757"
                      disabled={labelBusy === a.id}
                      onClick={() => doLabel(a.id, "true_attack")}
                    />
                    <ActionBtn
                      label="Faux positif"
                      color="#00ff88"
                      disabled={labelBusy === a.id}
                      onClick={() => doLabel(a.id, "false_positive")}
                    />
                    {a.ip && (
                      <a
                        href={`/dashboard?ip=${encodeURIComponent(a.ip)}#map`}
                        className="text-xs underline"
                        style={{ color: "#00d4ff" }}
                      >
                        Carte
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: "#64748b" }}>
            Aucune alerte pour l'instant.
          </div>
        )}
      </div>
    </main>
  );
}
