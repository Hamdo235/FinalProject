"use client";
import React from "react";
import {
  fetchAlerts, fetchIncidents, fetchBlockedIps, fetchModelMetrics, fetchDefenseActions,
} from "@/lib/api";
import { formatDateTimeLocal, parseApiDate } from "@/lib/time";
import { Alert, Incident, BlockedIp, ModelMetrics, DefenseAction } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import SimpleChart from "@/components/SimpleChart";
import {
  BarChart2, Download, Shield, AlertTriangle, Activity, Clock, ShieldOff,
} from "lucide-react";

type Period = "24h" | "7d" | "30d";

function periodMs(p: Period): number {
  return p === "24h" ? 86_400_000 : p === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
}

function fmtDate(iso: string): string {
  return formatDateTimeLocal(iso);
}

function sevColor(s: string) {
  if (s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#10b981";
}

function StatCard({ title, value, color, icon: Icon }: { title: string; value: string | number; color: string; icon: React.ElementType }) {
  return (
    <div
      className="cyber-card p-5 flex flex-col gap-3"
      style={{ borderColor: `${color}20` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>{title}</span>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono-cyber" style={{ color }}>{value}</div>
    </div>
  );
}

function exportCsv(alerts: Alert[]) {
  const headers = ["id", "ts", "source", "ip", "rule", "severity", "score", "status"];
  const rows = alerts.map((a) =>
    [a.id, a.ts, a.source, a.ip ?? "", a.rule ?? "", a.severity, a.score.toFixed(4), a.status].join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cybersentinel-alertes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportTxt(alerts: Alert[], incidents: Incident[], blocked: BlockedIp[], metrics: ModelMetrics | null) {
  const lines = [
    "═══════════════════════════════════════════════════",
    "        RAPPORT CYBERSENTINEL-LLM",
    `        Généré le : ${new Date().toLocaleString("fr-FR")}`,
    "═══════════════════════════════════════════════════",
    "",
    "── RÉSUMÉ ────────────────────────────────────────",
    `  Alertes totales        : ${alerts.length}`,
    `  Alertes critiques      : ${alerts.filter((a) => a.severity === "high").length}`,
    `  Incidents ouverts      : ${incidents.filter((i) => i.status === "open").length}`,
    `  IPs bloquées (actives) : ${blocked.length}`,
    "",
    "── MODÈLE ML ─────────────────────────────────────",
    metrics
      ? [
          `  F1-score    : ${metrics.f1?.toFixed(3) ?? "N/A"}`,
          `  Précision   : ${metrics.precision?.toFixed(3) ?? "N/A"}`,
          `  Rappel      : ${metrics.recall?.toFixed(3) ?? "N/A"}`,
          `  ROC-AUC     : ${metrics.roc_auc?.toFixed(3) ?? "N/A"}`,
          `  Échantillons: ${metrics.samples}`,
        ].join("\n")
      : "  Métriques non disponibles (alertes non labellisées)",
    "",
    "── TOP 5 IPs ATTAQUANTES ─────────────────────────",
    ...Object.entries(
      alerts.reduce<Record<string, number>>((acc, a) => { if (a.ip) acc[a.ip] = (acc[a.ip] ?? 0) + 1; return acc; }, {})
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ip, n]) => `  ${ip.padEnd(20)} ${n} alerte(s)`),
    "",
    "── IPs BLOQUÉES ──────────────────────────────────",
    ...blocked.map((b) => `  ${b.ip.padEnd(18)} | ${b.reason.slice(0, 30)} | ${b.approved_by}`),
    "",
    "═══════════════════════════════════════════════════",
  ];
  const txt = lines.join("\n");
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapport-cybersentinel-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [period, setPeriod] = React.useState<Period>("24h");
  const [allAlerts, setAllAlerts] = React.useState<Alert[]>([]);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [blocked, setBlocked] = React.useState<BlockedIp[]>([]);
  const [metrics, setMetrics] = React.useState<ModelMetrics | null>(null);
  const [defenseActions, setDefenseActions] = React.useState<DefenseAction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [a, i, b, m, da] = await Promise.all([
          fetchAlerts(),
          fetchIncidents(),
          fetchBlockedIps(),
          fetchModelMetrics().catch(() => null),
          fetchDefenseActions({ limit: 200 }),
        ]);
        setAllAlerts(a); setIncidents(i); setBlocked(b); setMetrics(m); setDefenseActions(da);
      } catch {
        setLoadError(true);
      } finally { setLoading(false); }
    })();
  }, []);

  const since = Date.now() - periodMs(period);

  const alerts = React.useMemo(
    () => allAlerts.filter((a) => parseApiDate(a.ts).getTime() >= since),
    [allAlerts, since]
  );

  const topIps = React.useMemo(() => {
    const map: Record<string, { count: number; maxSev: string; last: string }> = {};
    for (const a of alerts) {
      if (!a.ip) continue;
      const e = map[a.ip] ?? { count: 0, maxSev: "low", last: "" };
      e.count += 1;
      if (a.severity === "high" || (a.severity === "medium" && e.maxSev !== "high")) e.maxSev = a.severity;
      if (!e.last || a.ts > e.last) e.last = a.ts;
      map[a.ip] = e;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([ip, v]) => ({ ip, ...v }));
  }, [alerts]);

  const ruleData = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of alerts) {
      const k = a.rule || a.source || "unknown";
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const blockHistory = React.useMemo(
    () => defenseActions.filter((da) => da.action === "block_temp").slice(0, 20),
    [defenseActions]
  );

  const openInc = incidents.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Rapports</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>Analyse consolidée de la sécurité réseau.</p>
        </div>
        {/* Period filter */}
        <div className="flex gap-1.5">
          {(["24h", "7d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold font-mono-cyber transition-all"
              style={
                period === p
                  ? { background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee" }
                  : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#64748b" }
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Impossible de contacter le backend — vérifiez que le serveur est démarré.
        </div>
      )}

      {/* ── Section 1 : Résumé période ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Alertes" value={loading ? "…" : alerts.length} color="#22d3ee" icon={Activity} />
        <StatCard title="Critiques" value={loading ? "…" : alerts.filter((a) => a.severity === "high").length} color="#ef4444" icon={AlertTriangle} />
        <StatCard title="Incidents ouverts" value={loading ? "…" : openInc} color="#f59e0b" icon={Shield} />
        <StatCard title="IPs bloquées" value={loading ? "…" : blocked.length} color="#a78bfa" icon={ShieldOff} />
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title: "F1-score", value: metrics.samples > 0 ? metrics.f1?.toFixed(3) : "N/A", color: "#10b981" },
            { title: "Précision", value: metrics.samples > 0 ? metrics.precision?.toFixed(3) : "N/A", color: "#10b981" },
            { title: "Rappel", value: metrics.samples > 0 ? metrics.recall?.toFixed(3) : "N/A", color: "#10b981" },
            { title: "ROC-AUC", value: metrics.roc_auc != null ? metrics.roc_auc.toFixed(3) : "N/A", color: "#3b82f6" },
          ].map(({ title, value, color }) => (
            <StatCard key={title} title={title} value={value ?? "N/A"} color={color} icon={BarChart2} />
          ))}
        </div>
      )}

      {/* ── Section 2 : Top 5 IPs attaquantes ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#ef4444" }} />
            Top 5 IPs attaquantes — {period}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topIps.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "#334155" }}>Aucune alerte sur la période.</div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>IP Source</th>
                  <th>Alertes</th>
                  <th>Sévérité max</th>
                  <th>Dernière activité</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {topIps.map((ip, i) => {
                  const isBlocked = blocked.some((b) => b.ip === ip.ip);
                  return (
                    <tr key={ip.ip}>
                      <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#334155" }}>#{i + 1}</td>
                      <td className="px-4 py-3 font-mono-cyber text-xs font-bold" style={{ color: "#22d3ee" }}>{ip.ip}</td>
                      <td className="px-4 py-3 font-bold font-mono-cyber text-xs" style={{ color: "#e2e8f0" }}>{ip.count}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono-cyber"
                          style={{ background: `${sevColor(ip.maxSev)}15`, border: `1px solid ${sevColor(ip.maxSev)}30`, color: sevColor(ip.maxSev) }}>
                          {ip.maxSev}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                        {ip.last ? fmtDate(ip.last) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold font-mono-cyber"
                          style={{ color: isBlocked ? "#ef4444" : "#10b981" }}>
                          {isBlocked ? "🔴 Bloquée" : "🟢 Libre"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3 : Distribution attaques par règle ── */}
      <SimpleChart
        title={`Distribution des attaques par règle — ${period}`}
        data={ruleData}
        type="bar"
        xKey="name"
        yKey="value"
        loading={loading}
      />

      {/* ── Section 4 : Historique des blocages ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4" style={{ color: "#a78bfa" }} />
            Historique des blocages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blockHistory.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "#334155" }}>Aucun blocage enregistré.</div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Approuvé par</th>
                  <th>Créé le</th>
                  <th>Expire</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {blockHistory.map((da) => (
                  <tr key={da.id}>
                    <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#22d3ee" }}>{da.ip ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>{da.approved_by ?? da.created_by ?? "système"}</td>
                    <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                      {da.created_at ? fmtDate(da.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                      {da.expires_at ? fmtDate(da.expires_at) : "∞"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold font-mono-cyber"
                        style={{
                          color: da.revoked_at ? "#64748b"
                            : da.active ? "#10b981"
                            : "#334155",
                        }}>
                        {da.revoked_at ? "Révoqué" : da.active ? "Actif" : "Expiré"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 5 : Export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" style={{ color: "#22d3ee" }} />
            Export des données
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <button
            onClick={() => exportCsv(alerts)}
            disabled={loading || alerts.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.08)"; }}
          >
            <Download className="h-3.5 w-3.5" />
            Exporter alertes CSV ({alerts.length})
          </button>
          <button
            onClick={() => exportTxt(alerts, incidents, blocked, metrics)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.08)"; }}
          >
            <Download className="h-3.5 w-3.5" />
            Exporter rapport .txt
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
