"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Activity, AlertTriangle, Shield, TrendingUp, Zap,
  Clock, MapPin, ChevronRight,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import SimpleChart from "@/components/SimpleChart";
import WorldMap from "@/components/WorldMap";
import {
  fetchAlerts, fetchIncidents, fetchModelMetrics,
  fetchDefenseActions,
} from "@/lib/api";
import { formatTimeLocal, parseApiDate } from "@/lib/time";
import { Alert, Incident, ModelMetrics, DefenseAction } from "@/types/api";
import Link from "next/link";
import { useRealtime } from "@/components/layout/RealtimeProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Play } from "lucide-react";

const SEV_BADGE: Record<string, "destructive" | "warning" | "success"> = {
  high: "destructive", medium: "warning", low: "success",
};

export default function DashboardPage() {
  const [alerts, setAlerts]           = React.useState<Alert[]>([]);
  const [incidents, setIncidents]     = React.useState<Incident[]>([]);
  const [metrics, setMetrics]         = React.useState<ModelMetrics | null>(null);
  const [defenseActions, setDefenseActions] = React.useState<DefenseAction[]>([]);
  const [loading, setLoading]         = React.useState(true);
  const [error, setError]             = React.useState<string | null>(null);
  const [live, setLive]               = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [a, i, m] = await Promise.all([fetchAlerts(), fetchIncidents(), fetchModelMetrics()]);
        const d = await fetchDefenseActions({ limit: 100 });
        setAlerts(a); setIncidents(i); setMetrics(m); setDefenseActions(d);
      } catch { setError("Impossible de charger les données du backend."); }
      finally { setLoading(false); }
    })();
  }, []);

  const { subscribeToAlerts, sseConnected } = useRealtime();
  React.useEffect(() => {
    return subscribeToAlerts((a) => {
      setAlerts((p) => [a, ...p.filter((x) => x.id !== a.id)]);
      setLive(true);
    });
  }, [subscribeToAlerts]);

  React.useEffect(() => {
    if (sseConnected) setLive(true);
  }, [sseConnected]);

  const alerts24h = React.useMemo(() => {
    const from = Date.now() - 86400000;
    return alerts.filter((a) => {
      const t = parseApiDate(a.ts).getTime();
      return Number.isFinite(t) && t >= from;
    });
  }, [alerts]);

  const totalAlerts    = alerts24h.length;
  const criticalAlerts = alerts24h.filter((a) => a.severity === "high").length;
  const openIncidents  = incidents.filter((i) => i.status === "open").length;
  const activeBlocks   = defenseActions.filter((a) => a.active && a.action === "block_temp").length;

  const f1Display = React.useMemo(() => {
    if (!metrics || (metrics as any).samples === 0) return "N/A";
    return typeof metrics.f1 === "number" ? metrics.f1.toFixed(3) : "N/A";
  }, [metrics]);

  const timelineData = React.useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 24 }).map((_, i) => {
      const s = new Date(now - (23 - i) * 3600000);
      s.setMinutes(0, 0, 0);
      return {
        time: s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        startMs: s.getTime(),
        count: 0,
      };
    });
    for (const a of alerts24h) {
      const t = parseApiDate(a.ts).getTime();
      if (!Number.isFinite(t)) continue;
      const d = Math.floor((t - buckets[0].startMs) / 3600000);
      if (d >= 0 && d < buckets.length) buckets[d].count++;
    }
    return buckets.map(({ time, count }) => ({ time, count }));
  }, [alerts24h]);

  const severityData = React.useMemo(() => [
    { name: "Critique", value: alerts24h.filter((a) => a.severity === "high").length },
    { name: "Moyenne",  value: alerts24h.filter((a) => a.severity === "medium").length },
    { name: "Faible",   value: alerts24h.filter((a) => a.severity === "low").length },
  ], [alerts24h]);

  const activity = React.useMemo(() => {
    const a = alerts.slice(0, 10).map((al) => ({
      type: "alert", id: al.id,
      ts: parseApiDate(al.ts).getTime(),
      label: `Alerte ${al.severity} — ${al.source}${al.ip ? ` — ${al.ip}` : ""}`,
      severity: al.severity,
    }));
    const i = incidents.slice(0, 10).map((inc) => ({
      type: "incident", id: inc.id,
      ts: parseApiDate(inc.created_at).getTime(),
      label: `Incident #${inc.id} — ${inc.status} — risque ${inc.risk || "n/a"}`,
      severity: inc.risk || "low",
    }));
    return [...a, ...i]
      .filter((x) => Number.isFinite(x.ts))
      .sort((x, y) => y.ts - x.ts)
      .slice(0, 10);
  }, [alerts, incidents]);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            Vue opérationnelle
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            Alertes, incidents et ML en temps réel.
          </p>
        </div>
        {live && (
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-mono-cyber animate-pulse-badge"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#10b981",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#10b981" }} />
            LIVE
          </span>
        )}
      </div>

      {/* ── First-time CTA ── */}
      {!loading && alerts.length === 0 && !error && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4 animate-fade-in"
          style={{
            background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(139,92,246,0.06))",
            border: "1px solid rgba(34,211,238,0.2)",
          }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)" }}
          >
            <Play className="h-5 w-5" style={{ color: "#22d3ee" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
              Premier démarrage ?
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
              Aucune donnée n’est encore enregistrée. Lancez le pipeline de démonstration pour voir les alertes,
              la détection ML, l’enrichissement GeoIP et l’analyse LLM en action.
            </p>
          </div>
          <Link href="/demo" className="shrink-0">
            <Button>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Lancer la démo
            </Button>
          </Link>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Alertes 24h"
          value={loading ? "…" : totalAlerts}
          subtitle="Toutes sévérités"
          loading={loading}
          accent="cyan"
          icon={<Activity className="h-4 w-4" style={{ color: "#22d3ee" }} />}
        />
        <MetricCard
          title="Critiques"
          value={loading ? "…" : criticalAlerts}
          subtitle="Sévérité haute"
          loading={loading}
          accent="red"
          icon={<AlertTriangle className="h-4 w-4" style={{ color: "#ef4444" }} />}
        />
        <MetricCard
          title="Incidents ouverts"
          value={loading ? "…" : openIncidents}
          subtitle="En cours"
          loading={loading}
          accent="amber"
          icon={<Shield className="h-4 w-4" style={{ color: "#f59e0b" }} />}
        />
        <MetricCard
          title="F1-score"
          value={loading ? "…" : f1Display}
          subtitle="Modèle ML"
          loading={loading}
          accent="green"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#10b981" }} />}
        />
        <MetricCard
          title="Blocages actifs"
          value={loading ? "…" : activeBlocks}
          subtitle="Défense"
          loading={loading}
          accent="blue"
          icon={<Zap className="h-4 w-4" style={{ color: "#3b82f6" }} />}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/alerts",    label: "Voir les alertes",    color: "#22d3ee" },
          { href: "/incidents", label: "Voir les incidents",   color: "#22d3ee" },
          { href: "/chat",      label: "Interroger le SOC IA", color: "#f59e0b" },
          { href: "/demo",      label: "Lancer une démo",      color: "#22d3ee" },
        ].map(({ href, label, color }) => (
          <Link
            key={label}
            href={href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{
              border: `1px solid ${color}30`,
              color,
              background: `${color}0a`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${color}18`;
              (e.currentTarget as HTMLElement).style.borderColor = `${color}55`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${color}0a`;
              (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
            }}
          >
            {label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>

      {/* ── Timeline + Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="map">
        <SimpleChart
          title="Timeline des alertes (24h)"
          data={timelineData}
          type="line"
          xKey="time"
          yKey="count"
          loading={loading}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: "#22d3ee" }} />
                Carte GeoIP
              </span>
              <span className="text-xs font-mono-cyber" style={{ color: "#334155" }}>
                Points enrichis
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <WorldMap height="256px" refreshInterval={live ? 4000 : 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Severity chart ── */}
      <SimpleChart
        title="Répartition par sévérité"
        data={severityData}
        type="bar"
        xKey="name"
        yKey="value"
        loading={loading}
      />

      {/* ── Latest alerts ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Dernières alertes</span>
            <Link
              href="/alerts"
              className="text-xs font-medium flex items-center gap-1 transition-all"
              style={{ color: "#22d3ee" }}
            >
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {loading ? (
            <div className="p-5 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              title="Aucune alerte récente"
              description="Le pipeline n’a détecté aucune anomalie. Lancez la démonstration pour voir le système en action."
            >
              <Link href="/demo">
                <Button>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Lancer la démo
                </Button>
              </Link>
            </EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sévérité</th>
                  <th>Source</th>
                  <th>IP</th>
                  <th>Score</th>
                  <th className="text-right">Heure</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 6).map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <Badge variant={SEV_BADGE[a.severity] ?? "default"}>{a.severity}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-sm" style={{ color: "#e2e8f0" }}>
                      {a.source}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber text-xs" style={{ color: "#22d3ee" }}>
                      {a.ip || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono-cyber text-xs font-semibold" style={{ color: "#10b981" }}>
                      {a.score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                      {formatTimeLocal(a.ts)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Activity feed ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: "#64748b" }} />
            Flux d&apos;activité
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {activity.length === 0 ? (
            <div className="text-sm py-4" style={{ color: "#64748b" }}>
              Aucune activité récente.
            </div>
          ) : (
            <div className="space-y-0">
              {activity.map((evt) => (
                <div
                  key={`${evt.type}-${evt.id}`}
                  className="flex items-center justify-between py-2.5 px-1 rounded-lg"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        background:
                          evt.severity === "high"
                            ? "#ef4444"
                            : evt.severity === "medium"
                            ? "#f59e0b"
                            : "#10b981",
                        boxShadow:
                          evt.severity === "high"
                            ? "0 0 6px rgba(239,68,68,0.5)"
                            : evt.severity === "medium"
                            ? "0 0 6px rgba(245,158,11,0.5)"
                            : "0 0 6px rgba(16,185,129,0.5)",
                      }}
                    />
                    <span className="text-sm" style={{ color: "#94a3b8" }}>
                      {evt.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono-cyber shrink-0" style={{ color: "#334155" }}>
                    {formatTimeLocal(evt.ts)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="text-sm" style={{ color: "#ef4444" }}>
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
