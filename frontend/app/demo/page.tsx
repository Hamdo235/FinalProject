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

const STEPS = [
  { label: "Génération des logs réseau",    desc: "Simulation de trafic SSH/HTTP suspect" },
  { label: "Détection ML (RandomForest)",   desc: "Classification par le modèle entraîné" },
  { label: "Enrichissement GeoIP",          desc: "Localisation des IP sources" },
  { label: "Analyse LLM + RAG MITRE",       desc: "Corrélation ATT&CK et explication SOC" },
  { label: "Recommandations défensives",    desc: "Actions proposées à l'opérateur" },
];

export default function DemoPage() {
  const [running, setRunning] = React.useState(false);
  const [alerts, setAlerts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ id: number; severity?: string; ip?: string } | null>(null);
  const [activeStep, setActiveStep] = React.useState<number>(-1);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [logs, setLogs] = React.useState<string[]>([]);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    fetchAlerts().then(setAlerts).catch(() => setError("Impossible de charger les alertes."));
  }, []);

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

  // Scroll auto vers le bas des logs
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Simulation de la progression des étapes
  const runStepAnimation = React.useCallback(async () => {
    setCompletedSteps(new Set());
    setActiveStep(-1);
    setLogs([]);

    const logLines = [
      "[00:00.001] Initialisation du module de détection...",
      "[00:00.142] Connexion à la base de logs réseau...",
      "[00:00.387] Génération de 50 événements réseau suspects...",
      "[00:00.521] SSH brute-force détecté depuis 185.220.101.45",
      "[00:00.634] Port scan détecté depuis 45.33.32.156",
      "[00:00.891] Chargement du modèle RandomForest (v2.3)...",
      "[00:01.023] Classification : HIGH (score=0.94) — 185.220.101.45",
      "[00:01.187] Classification : MEDIUM (score=0.71) — 45.33.32.156",
      "[00:01.342] Enrichissement GeoIP en cours...",
      "[00:01.456] 185.220.101.45 → RU, Moscou (Tor exit node)",
      "[00:01.589] 45.33.32.156 → DE, Francfort",
      "[00:01.734] Appel Ollama llama3.2 + contexte MITRE ATT&CK RAG...",
      "[00:02.891] T1110.001 Password Guessing — confidence: 0.87",
      "[00:03.012] T1046 Network Service Discovery — confidence: 0.73",
      "[00:03.156] Recommandations générées : bloquer IP + alerter équipe",
      "[00:03.234] Simulation terminée. 2 incidents créés.",
    ];

    for (let step = 0; step < STEPS.length; step++) {
      setActiveStep(step);
      const stepLogs = logLines.slice(step * 3, step * 3 + 3);
      for (const line of stepLogs) {
        await new Promise((r) => setTimeout(r, 280));
        setLogs((prev) => [...prev, line]);
      }
      await new Promise((r) => setTimeout(r, 400));
      setCompletedSteps((prev) => new Set([...prev, step]));
    }
    setActiveStep(-1);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await demoGenerate();
      setRunning(true);
      runStepAnimation();
    } catch (e) {
      setError("Impossible de démarrer la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setRunning(false);
    setActiveStep(-1);
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await demoReset();
      setRunning(false);
      setAlerts([]);
      setLogs([]);
      setActiveStep(-1);
      setCompletedSteps(new Set());
    } catch (e) {
      setError("Impossible de réinitialiser.");
    } finally {
      setLoading(false);
    }
  };

  const alerts24h = React.useMemo(() => {
    const from24h = Date.now() - 24 * 60 * 60 * 1000;
    return alerts.filter((a) => {
      const t = new Date(a.ts).getTime();
      return Number.isFinite(t) && t >= from24h;
    });
  }, [alerts]);

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

  const topIps = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts24h) {
      const ip = a.ip;
      if (!ip) continue;
      counts.set(ip, (counts.get(ip) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [alerts24h]);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Toast nouvelle alerte */}
      {toast && (
        <button
          type="button"
          onClick={() => router.push("/alerts")}
          className="fixed bottom-6 right-6 z-[2000] w-[320px] text-left rounded-xl p-4 transition-all animate-alert-in"
          style={{
            background: "#0f1629",
            border: "1px solid rgba(0,212,255,0.35)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(0,212,255,0.1)",
          }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: "#00d4ff" }}>
            ● Nouvelle alerte détectée
          </div>
          <div className="font-semibold" style={{ color: "#e2e8f0" }}>Alerte #{toast.id}</div>
          <div className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {toast.ip ? `IP: ${toast.ip} — ` : ""}Sévérité:{" "}
            <span
              style={{
                color:
                  toast.severity === "high"
                    ? "#ff4757"
                    : toast.severity === "medium"
                    ? "#ffa502"
                    : "#00ff88",
              }}
            >
              {toast.severity || "N/A"}
            </span>
          </div>
          <div className="text-xs mt-2" style={{ color: "#00d4ff" }}>
            Cliquer pour ouvrir les alertes →
          </div>
        </button>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "#e2e8f0" }}>
          Démo — Simulation IDS Cognitif
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>
          Pipeline complet : détection ML → enrichissement GeoIP → analyse LLM + MITRE ATT&CK RAG.
        </p>
      </div>

      {/* Contrôles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio
              className="h-4 w-4"
              style={{ color: running ? "#00d4ff" : "#64748b" }}
            />
            Contrôle de simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleStart}
              disabled={running || loading}
              className={running ? "" : "glow-cyan"}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Démarrage...
                </span>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1.5" />
                  Lancer simulation
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={handleStop} disabled={!running || loading}>
              <Square className="h-3 w-3 mr-1.5" />
              Arrêter
            </Button>
            <Button size="sm" variant="secondary" onClick={handleReset} disabled={loading}>
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Réinitialiser
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeBadge live={running} />
            <span className="text-xs" style={{ color: "#64748b" }}>
              {running ? "Pipeline de détection en cours d'exécution…" : "Simulation arrêtée."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline des étapes */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline de traitement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Ligne de progression */}
            <div
              className="absolute left-5 top-5 bottom-5 w-px"
              style={{ background: "rgba(0,212,255,0.15)" }}
            />
            <div className="space-y-4">
              {STEPS.map((step, idx) => {
                const isActive    = activeStep === idx;
                const isCompleted = completedSteps.has(idx);
                return (
                  <div key={idx} className="flex items-start gap-4 relative">
                    {/* Cercle numéroté */}
                    <div
                      className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold font-mono-cyber flex-shrink-0 transition-all"
                      style={
                        isCompleted
                          ? { background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "2px solid rgba(0,255,136,0.5)" }
                          : isActive
                          ? { background: "rgba(0,212,255,0.2)", color: "#00d4ff", border: "2px solid rgba(0,212,255,0.6)", boxShadow: "0 0 16px rgba(0,212,255,0.3)" }
                          : { background: "rgba(100,116,139,0.1)", color: "#64748b", border: "2px solid rgba(100,116,139,0.2)" }
                      }
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>
                    {/* Contenu */}
                    <div className="flex-1 pt-1.5">
                      <div
                        className="text-sm font-medium transition-all"
                        style={{
                          color: isCompleted ? "#00ff88" : isActive ? "#00d4ff" : "#64748b",
                        }}
                      >
                        {step.label}
                        {isActive && (
                          <span className="ml-2 text-xs animate-blink" style={{ color: "#00d4ff" }}>
                            ▌
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                        {step.desc}
                      </div>
                      {isActive && (
                        <div
                          className="mt-2 h-1 rounded-full overflow-hidden"
                          style={{ background: "rgba(0,212,255,0.1)" }}
                        >
                          <div
                            className="h-full rounded-full animate-scan"
                            style={{
                              background: "linear-gradient(90deg, #00d4ff, #00ff88)",
                              animationDuration: "1.5s",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zone logs terminal */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono-cyber">
              <span style={{ color: "#00ff88" }}>$</span> Logs système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="terminal-bg rounded-lg p-4 h-48 overflow-y-auto"
              style={{ background: "#080c18" }}
            >
              {logs.map((line, i) => (
                <div
                  key={i}
                  className="animate-log-in text-xs"
                  style={{ color: "#00ff88", animationDelay: `${i * 0.05}s` }}
                >
                  {line}
                </div>
              ))}
              {running && (
                <div className="text-xs mt-1" style={{ color: "#00d4ff" }}>
                  <span className="animate-blink">▌</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardTitle>Top IP suspectes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-auto">
              {topIps.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: "#64748b" }}>
                  Aucune IP pour l'instant.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {topIps.map(([ip, c]) => (
                    <div
                      key={ip}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span className="font-mono-cyber text-xs" style={{ color: "#00d4ff" }}>
                        {ip}
                      </span>
                      <span
                        className="cyber-badge font-mono-cyber"
                        style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.25)" }}
                      >
                        {c}
                      </span>
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
          <CardContent className="text-sm" style={{ color: "#ff4757" }}>{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
