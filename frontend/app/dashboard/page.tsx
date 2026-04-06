"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Activity, AlertTriangle, Shield, TrendingUp } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import SimpleChart from "@/components/SimpleChart";
import WorldMap from "@/components/WorldMap";
import { fetchAlerts, fetchIncidents, fetchModelMetrics, fetchDefenseActions, createAlertsSSE } from "@/lib/api";
import { Alert, Incident, ModelMetrics, DefenseAction } from "@/types/api";

const SEV_BADGE: Record<string, "destructive" | "warning" | "success"> = {
  high: "destructive",
  medium: "warning",
  low: "success",
};

export default function DashboardPage() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [metrics, setMetrics] = React.useState<ModelMetrics | null>(null);
  const [defenseActions, setDefenseActions] = React.useState<DefenseAction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [alertsRes, incidentsRes, metricsRes] = await Promise.all([
          fetchAlerts(),
          fetchIncidents(),
          fetchModelMetrics(),
        ]);
        const defenseRes = await fetchDefenseActions({ limit: 100 });
        setAlerts(alertsRes);
        setIncidents(incidentsRes);
        setMetrics(metricsRes);
        setDefenseActions(defenseRes);
      } catch (e) {
        setError("Impossible de charger les données du backend.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  React.useEffect(() => {
    const es = createAlertsSSE((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setLive(true);
    });
    return () => es.close();
  }, []);

  const alerts24h = React.useMemo(() => {
    const from24h = Date.now() - 24 * 60 * 60 * 1000;
    return alerts.filter((a) => {
      const t = new Date(a.ts).getTime();
      return Number.isFinite(t) && t >= from24h;
    });
  }, [alerts]);

  const totalAlerts    = alerts24h.length;
  const criticalAlerts = alerts24h.filter((a) => a.severity === "high").length;
  const openIncidents  = incidents.filter((i) => i.status === "open").length;
  const activeBlocks   = defenseActions.filter((a) => a.active && a.action === "block_temp").length;

  const timelineData = React.useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 24 }).map((_, idx) => {
      const start = new Date(now - (23 - idx) * 60 * 60 * 1000);
      start.setMinutes(0, 0, 0);
      const label = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return { time: label, startMs: start.getTime(), count: 0 };
    });
    for (const a of alerts24h) {
      const t = new Date(a.ts).getTime();
      if (!Number.isFinite(t)) continue;
      const diffH = Math.floor((t - buckets[0].startMs) / (60 * 60 * 1000));
      if (diffH >= 0 && diffH < buckets.length) buckets[diffH].count += 1;
    }
    return buckets.map(({ time, count }) => ({ time, count }));
  }, [alerts24h]);

  const severityData = React.useMemo(
    () => [
      { name: "Critique", value: alerts24h.filter((a) => a.severity === "high").length },
      { name: "Moyenne",  value: alerts24h.filter((a) => a.severity === "medium").length },
      { name: "Faible",   value: alerts24h.filter((a) => a.severity === "low").length },
    ],
    [alerts24h]
  );

  const f1Display = React.useMemo(() => {
    if (!metrics) return "N/A";
    if ((metrics as any).samples === 0) return "N/A";
    if (typeof metrics.f1 === "number") return metrics.f1.toFixed(3);
    return "N/A";
  }, [metrics]);

  const activity = React.useMemo(() => {
    const a = alerts.slice(0, 10).map((al) => ({
      type: "alert",
      id: al.id,
      ts: new Date(al.ts).getTime(),
      label: `Alerte ${al.severity} • ${al.source}${al.ip ? ` • ${al.ip}` : ""}`,
      severity: al.severity,
    }));
    const i = incidents.slice(0, 10).map((inc) => ({
      type: "incident",
      id: inc.id,
      ts: new Date(inc.created_at).getTime(),
      label: `Incident #${inc.id} • ${inc.status} • ${inc.risk || "n/a"}`,
      severity: inc.risk || "low",
    }));
    return [...a, ...i]
      .filter((x) => Number.isFinite(x.ts))
      .sort((x, y) => y.ts - x.ts)
      .slice(0, 10);
  }, [alerts, incidents]);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: "#e2e8f0", letterSpacing: "-0.01em" }}
          >
            Dashboard opérationnel
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Vue d'ensemble en temps réel des alertes, incidents et performance du modèle.
          </p>
        </div>
        {live && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full animate-pulse-badge text-xs font-semibold font-mono-cyber"
            style={{
              background: "rgba(0, 212, 255, 0.1)",
              border: "1px solid rgba(0, 212, 255, 0.35)",
              color: "#00d4ff",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "#00d4ff" }}
            />
            LIVE
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total alertes"
          value={loading ? "..." : totalAlerts}
          subtitle="24 dernières heures"
          loading={loading}
          icon={<Activity className="h-4 w-4" style={{ color: "#00d4ff" }} />}
        />
        <MetricCard
          title="Alertes critiques"
          value={loading ? "..." : criticalAlerts}
          subtitle="Sévérité haute"
          loading={loading}
          icon={<AlertTriangle className="h-4 w-4" style={{ color: "#ff4757" }} />}
        />
        <MetricCard
          title="Incidents ouverts"
          value={loading ? "..." : openIncidents}
          subtitle="En cours de traitement"
          loading={loading}
          icon={<Shield className="h-4 w-4" style={{ color: "#ffa502" }} />}
        />
        <MetricCard
          title="F1-score"
          value={loading ? "..." : f1Display}
          subtitle="Modèle actuel"
          loading={loading}
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#00ff88" }} />}
        />
        <MetricCard
          title="Blocages actifs"
          value={loading ? "..." : activeBlocks}
          subtitle="Défense applicative"
          loading={loading}
          icon={<Shield className="h-4 w-4" style={{ color: "#ff4757" }} />}
        />
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/alerts",    label: "Ouvrir les alertes",  color: "#00d4ff" },
          { href: "/incidents", label: "Voir les incidents",  color: "#00d4ff" },
          { href: "/chat",      label: "Poser une question",  color: "#00d4ff" },
          { href: "/alerts",    label: "Voir la défense",     color: "#ff4757" },
        ].map(({ href, label, color }) => (
          <a
            key={label}
            href={href}
            className="px-3 py-1.5 rounded text-sm transition-all"
            style={{
              border: `1px solid ${color}33`,
              color,
              background: `${color}0a`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${color}18`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${color}0a`;
            }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Timeline et Carte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="map">
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
              <span>Carte GeoIP</span>
              <span className="text-xs" style={{ color: "#64748b" }}>Derniers points enrichis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <WorldMap height="256px" refreshInterval={live ? 4000 : 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Répartition sévérité */}
      <SimpleChart
        title="Répartition par sévérité"
        data={severityData}
        type="bar"
        xKey="name"
        yKey="value"
        loading={loading}
      />

      {/* Dernières alertes */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières alertes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-4 text-sm" style={{ color: "#64748b" }}>Aucune alerte récente.</div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between text-sm py-2 px-2 rounded-lg transition-all"
                  style={{ borderBottom: "1px solid rgba(0,212,255,0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={SEV_BADGE[alert.severity] ?? "default"}>
                      {alert.severity}
                    </Badge>
                    <span style={{ color: "#e2e8f0" }}>{alert.source}</span>
                    {alert.ip && (
                      <span className="font-mono-cyber text-xs" style={{ color: "#64748b" }}>
                        {alert.ip}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono-cyber" style={{ color: "#64748b" }}>
                    {new Date(alert.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flux d'activité */}
      <Card>
        <CardHeader>
          <CardTitle>Flux d'activité</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-sm" style={{ color: "#64748b" }}>Aucune activité récente.</div>
          ) : (
            <div className="space-y-1">
              {activity.map((evt) => (
                <div
                  key={`${evt.type}-${evt.id}`}
                  className="flex items-center justify-between text-sm py-2 px-2 rounded"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{
                        background:
                          evt.severity === "high"
                            ? "#ff4757"
                            : evt.severity === "medium"
                            ? "#ffa502"
                            : "#00ff88",
                      }}
                    />
                    <span style={{ color: "#e2e8f0" }}>{evt.label}</span>
                  </div>
                  <div className="text-xs font-mono-cyber" style={{ color: "#64748b" }}>
                    {new Date(evt.ts).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="text-sm" style={{ color: "#ff4757" }}>{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
