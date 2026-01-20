"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import RealtimeBadge from "@/components/RealtimeBadge";
import SimpleChart from "@/components/SimpleChart";
import WorldMap from "@/components/WorldMap";
import { Play, Square, RotateCcw, Radio } from "lucide-react";
import { demoGenerate, demoReset, fetchAlerts, createAlertsSSE } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const [running, setRunning] = React.useState(false);
  const [alerts, setAlerts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ id: number; severity?: string; ip?: string } | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    fetchAlerts().then(setAlerts).catch(() => setError("Impossible de charger les alertes."));
  }, []);

  // SSE pour temps réel
  React.useEffect(() => {
    const es = createAlertsSSE((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setToast({ id: newAlert.id, severity: (newAlert as any).severity, ip: (newAlert as any).ip });
    });
    return () => es.close();
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await demoGenerate();
      setRunning(true);
    } catch (e) {
      setError("Impossible de démarrer la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await demoGenerate(); // backend toggle
      setRunning(false);
    } catch (e) {
      setError("Impossible d’arrêter la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await demoReset();
      setRunning(false);
      setAlerts([]);
    } catch (e) {
      setError("Impossible de réinitialiser.");
    } finally {
      setLoading(false);
    }
  };

  const now = Date.now();
  const from24h = now - 24 * 60 * 60 * 1000;
  const alerts24h = React.useMemo(
    () => alerts.filter((a) => {
      const t = new Date(a.ts).getTime();
      return Number.isFinite(t) && t >= from24h;
    }),
    [alerts]
  );

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

  const topIps = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts24h) {
      const ip = a.ip;
      if (!ip) continue;
      counts.set(ip, (counts.get(ip) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [alerts24h]);

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <button
          type="button"
          onClick={() => router.push("/alerts")}
          className="fixed bottom-4 right-4 z-[2000] w-[320px] text-left rounded-lg border bg-white shadow-lg p-3 hover:bg-neutral-50"
        >
          <div className="text-xs text-gray-500">Nouvelle alerte détectée</div>
          <div className="font-semibold">Alerte #{toast.id}</div>
          <div className="text-sm text-gray-600">
            {toast.ip ? `IP: ${toast.ip} — ` : ""}Sévérité: {toast.severity || "N/A"}
          </div>
          <div className="text-xs text-blue-600 mt-1">Clique pour ouvrir la page Alertes</div>
        </button>
      )}
      <div>
        <h1 className="text-xl font-semibold">Démo</h1>
        <p className="text-sm text-gray-600 mt-1">
          Simulation de logs en temps réel avec visualisation GeoIP et graphiques.
        </p>
      </div>

      {/* Contrôles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className={running ? "h-4 w-4 text-success animate-pulse-badge" : "h-4 w-4 text-gray-400"} />
            Simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleStart} disabled={running || loading}>
              <Play className="h-3 w-3 mr-1" />
              Démarrer
            </Button>
            <Button size="sm" variant="outline" onClick={handleStop} disabled={!running || loading}>
              <Square className="h-3 w-3 mr-1" />
              Arrêter
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} disabled={loading}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Réinitialiser
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeBadge live={running} />
            <span className="text-xs text-gray-500">
              {running ? "Génération de logs en cours…" : "Simulation arrêtée."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Carte et Top IP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Carte GeoIP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <WorldMap height="256px" refreshInterval={running ? 4000 : 0} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top IP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-auto">
              {topIps.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <span>Aucune IP pour l’instant.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {topIps.map(([ip, c]) => (
                    <div key={ip} className="flex items-center justify-between text-sm border-b py-1">
                      <span className="font-mono">{ip}</span>
                      <span className="text-gray-600">{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          title="Timeline des alertes"
          data={timelineData}
          type="line"
          xKey="time"
          yKey="count"
          loading={loading}
        />
        <SimpleChart
          title="Alertes par sévérité"
          data={severityData}
          type="bar"
          xKey="name"
          yKey="value"
          loading={loading}
        />
      </div>

      {error && (
        <Card>
          <CardContent className="text-danger text-sm">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
