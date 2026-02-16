"use client";
import { useEffect, useState } from "react";
import { fetchAlerts, labelAlert, createIncidentFromAlerts, createAlertsSSE } from "@/lib/api";
import { useRouter } from "next/navigation";

type Alert = {
  id: number;
  ts: string;
  source: string;
  ip?: string;
  user?: string;
  rule?: string;
  severity: string;
  score: number;
  status: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [labelBusy, setLabelBusy] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string>("");
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
      setMsg(`Alerte #${alertId} labellisée: ${label}.`);
    } catch (e) {
      setMsg(`Erreur labellisation alerte #${alertId}.`);
    } finally {
      setLabelBusy(null);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      for (const id of ids) {
        await labelAlert(id, label);
      }
      setBulkMsg(label === "true_attack" ? "Décision appliquée: attaque confirmée." : "Décision appliquée: faux positif.");
    } catch {
      setBulkMsg("Erreur lors de la décision en masse.");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <span className={`text-xs px-2 py-0.5 rounded border ${live ? "bg-green-100 text-green-700 border-green-300" : "bg-neutral-100 text-neutral-600 border-neutral-300"}`}>
          {live ? "LIVE" : "OFF"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={createIncident}
          className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50"
          disabled={selected.size === 0 || busy}
        >
          {busy ? "..." : `Créer incident (${selected.size})`}
        </button>
        <button
          onClick={() => applyBulkDecision("true_attack")}
          className="px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50 disabled:opacity-50"
          disabled={selected.size === 0 || bulkBusy}
        >
          Confirmer attaque
        </button>
        <button
          onClick={() => applyBulkDecision("false_positive")}
          className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={selected.size === 0 || bulkBusy}
        >
          Faux positif
        </button>
        <a
          href="/dashboard#map"
          className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
        >
          Voir sur la carte
        </a>
        <a
          href="/chat"
          className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
        >
          Ouvrir le chatbot
        </a>
      </div>
      {msg && <div className="text-sm text-green-700">{msg}</div>}
      {bulkMsg && <div className="text-sm text-blue-700">{bulkMsg}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Sel</th>
            <th>Time</th>
            <th>Source</th>
            <th>IP</th>
            <th>Rule</th>
            <th>Severity</th>
            <th>Score</th>
            <th>Label</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id} className="border-b hover:bg-neutral-50">
              <td className="py-2">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
              </td>
              <td>{new Date(a.ts).toLocaleString()}</td>
              <td>{a.source}</td>
              <td>{a.ip}</td>
              <td>{a.rule}</td>
              <td className="font-medium">{a.severity}</td>
              <td>{a.score.toFixed(2)}</td>
              <td className="py-2">
                <div className="flex gap-2 items-center">
                  <button
                    className="px-2 py-1 rounded border text-xs border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={labelBusy === a.id}
                    onClick={() => doLabel(a.id, "true_attack")}
                    type="button"
                  >
                    Attaque
                  </button>
                  <button
                    className="px-2 py-1 rounded border text-xs border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                    disabled={labelBusy === a.id}
                    onClick={() => doLabel(a.id, "false_positive")}
                    type="button"
                  >
                    Faux positif
                  </button>
                  {a.ip && (
                    <a
                      href={`/dashboard?ip=${encodeURIComponent(a.ip)}#map`}
                      className="text-xs text-blue-700 underline"
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
    </main>
  );
}
