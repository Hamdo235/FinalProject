"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { connectSSE } from "@/lib/sse";
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
  const router = useRouter();

  useEffect(() => {
    apiGet<Alert[]>("/alerts").then(setAlerts).catch(console.error);
    const disconnect = connectSSE("/stream/alerts", (evt) => {
      if (!live) setLive(true);
      if (evt?.type === "alert.created") {
        apiGet<Alert[]>("/alerts").then(setAlerts).catch(console.error);
      }
    });
    return () => disconnect();
  }, [live]);

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
      const res = await apiPost<{ id: number }>("/incidents/from-alerts", ids);
    // Backend returns full Incident; but we only need id; try to infer
    // @ts-ignore
      const incId = (res?.id as number) || (res as any).id || (res as any)?.incident_id || 1;
      setMsg(`Incident #${incId} créé.`);
      router.push(`/incidents/${incId}`);
    } finally {
      setBusy(false);
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
      <div className="flex gap-2">
        <button
          onClick={createIncident}
          className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50"
          disabled={selected.size === 0 || busy}
        >
          {busy ? "..." : `Créer incident (${selected.size})`}
        </button>
      </div>
      {msg && <div className="text-sm text-green-700">{msg}</div>}
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
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
