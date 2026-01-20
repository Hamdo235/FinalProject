"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Activity, AlertTriangle, Shield, TrendingUp } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import SimpleChart from "@/components/SimpleChart";
import WorldMap from "@/components/WorldMap";
import { fetchAlerts, fetchIncidents, fetchModelMetrics, createAlertsSSE } from "@/lib/api";
import { Alert, Incident, ModelMetrics } from "@/types/api";

export default function DashboardPage() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [metrics, setMetrics] = React.useState<ModelMetrics | null>(null);
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
        setAlerts(alertsRes);
        setIncidents(incidentsRes);
        setMetrics(metricsRes);
      } catch (e) {
        setError("Impossible de charger les données du backend.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // SSE pour temps réel
  React.useEffect(() => {
    const es = createAlertsSSE((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setLive(true);
    });
    return () => es.close();
  }, []);

  const now = Date.now();
  const from24h = now - 24 * 60 * 60 * 1000;
  const alerts24h = React.useMemo(
    () => alerts.filter((a) => {
      const t = new Date(a.ts).getTime();
      return Number.isFinite(t) && t >= from24h;
    }),
    [alerts]
  );

  const totalAlerts = alerts24h.length;
  const criticalAlerts = alerts24h.filter((a) => a.severity === "high").length;
  const openIncidents = incidents.filter((i) => i.status === "open").length;

  const timelineData = React.useMemo(() => {
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
      { name: "Moyenne", value: alerts24h.filter((a) => a.severity === "medium").length },
      { name: "Faible", value: alerts24h.filter((a) => a.severity === "low").length },
    ],
    [alerts24h]
  );

  const f1Display = React.useMemo(() => {
    if (!metrics) return "N/A";
    if ((metrics as any).samples === 0) return "N/A";
    if (typeof metrics.f1 === "number") return metrics.f1.toFixed(3);
    return "N/A";
  }, [metrics]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Vue d’ensemble en temps réel des alertes, incidents et performance du modèle.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total alertes"
          value={loading ? "..." : totalAlerts}
          subtitle="24 dernières heures"
          loading={loading}
          icon={<Activity className="h-4 w-4 text-primary-500" />}
        />
        <MetricCard
          title="Alertes critiques"
          value={loading ? "..." : criticalAlerts}
          subtitle="Sévérité haute"
          loading={loading}
          icon={<AlertTriangle className="h-4 w-4 text-danger" />}
        />
        <MetricCard
          title="Incidents ouverts"
          value={loading ? "..." : openIncidents}
          subtitle="En cours de traitement"
          loading={loading}
          icon={<Shield className="h-4 w-4 text-warning" />}
        />
        <MetricCard
          title="F1-score"
          value={loading ? "..." : f1Display}
          subtitle="Modèle actuel"
          loading={loading}
          icon={<TrendingUp className="h-4 w-4 text-success" />}
        />
      </div>

      {/* Timeline et Carte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <CardTitle>Carte GeoIP</CardTitle>
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

      {/* Dernières alertes (mini tableau) */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières alertes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-gray-500 py-4">Aucune alerte récente.</div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        alert.severity === "high"
                          ? "destructive"
                          : alert.severity === "medium"
                          ? "warning"
                          : "success"
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <span>{alert.source}</span>
                    {alert.ip && <span className="text-gray-500">{alert.ip}</span>}
                  </div>
                  <span className="text-gray-400">{new Date(alert.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="text-danger text-sm">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
