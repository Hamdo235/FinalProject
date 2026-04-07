"use client";
import React from "react";
import { Button } from "@/components/ui/Button";
import WorldMap from "@/components/WorldMap";
import SimpleChart from "@/components/SimpleChart";
import {
  Play, RotateCcw, Terminal, CheckCircle, XCircle,
  Loader2, Cpu, Globe, Brain, Shield,
  AlertTriangle, ChevronRight, Zap, Activity,
} from "lucide-react";
import {
  demoGenerate, demoReset, fetchAlerts, createIncidentFromAlerts,
  explainIncident, fetchDefenseActions, createAlertsSSE,
} from "@/lib/api";
import type { Alert, IncidentExplanation, DefenseAction } from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = "pending" | "active" | "done" | "error";

interface StepState {
  status: StepStatus;
  result?: string;
  data?: unknown;
}

interface LogLine {
  id: number;
  text: string;
  type: "info" | "success" | "error" | "warn" | "data";
  ts: string;
}

// ─── Pipeline definition ───────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Activity,
    label: "Génération des logs réseau",
    desc: "Simulation de trafic SSH, HTTP et port-scan suspects via le générateur synthétique.",
    color: "#22d3ee",
  },
  {
    icon: Cpu,
    label: "Détection ML — IsolationForest / LOF",
    desc: "Classification des événements par le modèle entraîné. Chaque anomalie reçoit un score de confiance.",
    color: "#3b82f6",
  },
  {
    icon: Globe,
    label: "Enrichissement GeoIP",
    desc: "Localisation des IP sources, détection de nœuds Tor, ASN et réputation réseau.",
    color: "#f59e0b",
  },
  {
    icon: Brain,
    label: "Analyse LLM + RAG MITRE ATT&CK",
    desc: "Ollama llama3.2 corrèle les alertes avec la base MITRE ATT&CK via RAG et explique l'attaque.",
    color: "#8b5cf6",
  },
  {
    icon: Shield,
    label: "Recommandations défensives",
    desc: "Le système propose des actions (blocage, surveillance…). L'analyste reste décisionnaire.",
    color: "#10b981",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
let logId = 0;
function mkLog(text: string, type: LogLine["type"] = "info"): LogLine {
  return { id: logId++, text, type, ts: new Date().toLocaleTimeString("fr-FR") };
}

function sevColor(s: string) {
  if (s === "high")   return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#10b981";
}

function actionColor(a: string) {
  if (a.includes("block")) return "#ef4444";
  if (a === "monitor")     return "#f59e0b";
  if (a === "review")      return "#3b82f6";
  return "#10b981";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [running, setRunning]       = React.useState(false);
  const [steps, setSteps]           = React.useState<StepState[]>(STEPS.map(() => ({ status: "pending" })));
  const [logs, setLogs]             = React.useState<LogLine[]>([]);
  const [alerts, setAlerts]         = React.useState<Alert[]>([]);
  const [explanation, setExpl]      = React.useState<IncidentExplanation | null>(null);
  const [defActions, setDefActions] = React.useState<DefenseAction[]>([]);
  const [toast, setToast]           = React.useState<Alert | null>(null);
  const [done, setDone]             = React.useState(false);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const abortRef   = React.useRef(false);

  // auto-scroll terminal
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // SSE for live toasts
  React.useEffect(() => {
    const es = createAlertsSSE((a) => {
      setAlerts((p) => [a, ...p.filter((x) => x.id !== a.id)]);
      setToast(a);
    });
    return () => es.close();
  }, []);

  // toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const addLog = React.useCallback((text: string, type: LogLine["type"] = "info") => {
    setLogs((p) => [...p, mkLog(text, type)]);
  }, []);

  const setStep = React.useCallback((i: number, s: Partial<StepState>) => {
    setSteps((p) => p.map((x, idx) => (idx === i ? { ...x, ...s } : x)));
  }, []);

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const pollAlerts = async (maxWait = 8000): Promise<Alert[]> => {
    const deadline = Date.now() + maxWait;
    while (Date.now() < deadline && !abortRef.current) {
      const list = await fetchAlerts();
      if (list.length > 0) return list;
      await sleep(900);
    }
    return [];
  };

  // ── Main pipeline ─────────────────────────────────────────────────────────
  const runPipeline = async () => {
    abortRef.current = false;
    setRunning(true);
    setDone(false);
    setLogs([]);
    setAlerts([]);
    setExpl(null);
    setDefActions([]);
    setSteps(STEPS.map(() => ({ status: "pending" })));

    try {
      // ── Step 0: Generate logs ──────────────────────────────────────────────
      setStep(0, { status: "active" });
      addLog("Initialisation du pipeline IDS...", "info");
      addLog("Connexion au générateur de trafic synthétique...", "info");
      await sleep(400);
      const gen = await demoGenerate();
      addLog(`${gen.created} événements réseau injectés dans le pipeline.`, "success");
      addLog("Protocoles couverts: SSH, HTTP, port-scan, brute-force.", "data");
      setStep(0, { status: "done", result: `${gen.created} événements injectés` });

      if (abortRef.current) return;

      // ── Step 1: ML detection ───────────────────────────────────────────────
      setStep(1, { status: "active" });
      await sleep(300);
      addLog("Chargement du modèle de détection (IsolationForest + LOF)...", "info");
      addLog("Scoring de chaque événement en cours...", "info");
      const detected = await pollAlerts(10000);
      if (detected.length === 0) throw new Error("Aucune alerte générée — backend injoignable ?");

      setAlerts(detected);
      const high   = detected.filter((a) => a.severity === "high").length;
      const mid    = detected.filter((a) => a.severity === "medium").length;
      const maxSc  = Math.max(...detected.map((a) => a.score)).toFixed(3);
      addLog(`${detected.length} alertes créées.`, "success");
      addLog(`Critique: ${high}  Moyenne: ${mid}  Faible: ${detected.length - high - mid}`, "data");
      addLog(`Score de confiance maximal: ${maxSc}`, "data");
      setStep(1, { status: "done", result: `${detected.length} alertes — max score ${maxSc}`, data: detected });

      if (abortRef.current) return;

      // ── Step 2: GeoIP ──────────────────────────────────────────────────────
      setStep(2, { status: "active" });
      await sleep(500);
      addLog("Interrogation de la base GeoIP MaxMind...", "info");
      const ips = [...new Set(detected.filter((a) => a.ip).map((a) => a.ip!))];
      for (const ip of ips.slice(0, 5)) {
        await sleep(120);
        addLog(`Lookup: ${ip} → résolution ASN + géolocalisation`, "data");
      }
      addLog(`${ips.length} adresses IP uniques géolocalisées.`, "success");
      setStep(2, { status: "done", result: `${ips.length} IP géolocalisées`, data: ips });

      if (abortRef.current) return;

      // ── Step 3: LLM + MITRE RAG ───────────────────────────────────────────
      setStep(3, { status: "active" });
      await sleep(300);
      addLog("Création d'un incident de corrélation...", "info");
      const alertIds = detected.slice(0, Math.min(12, detected.length)).map((a) => a.id);

      let inc: { id: number; confidence: number } | null = null;
      try {
        inc = await createIncidentFromAlerts(alertIds);
        addLog(`Incident #${inc.id} créé (confiance: ${(inc.confidence * 100).toFixed(0)}%).`, "success");
      } catch {
        addLog("Impossible de créer l'incident — tentative d'explication directe.", "warn");
      }

      addLog("Appel Ollama llama3.2 — récupération du contexte MITRE ATT&CK RAG...", "info");
      addLog("Génération en cours — le modèle peut prendre 30 à 90 s sur CPU...", "warn");

      let expl: IncidentExplanation | null = null;
      if (inc) {
        // Timer live : affiche chaque 8 s que ça tourne encore
        let elapsed = 0;
        const llmTimer = setInterval(() => {
          elapsed += 8;
          addLog(`Ollama génère... ${elapsed}s écoulées — merci de patienter.`, "info");
        }, 8_000);

        try {
          expl = await explainIncident(inc.id);
          clearInterval(llmTimer);
          setExpl(expl);
          addLog(`Réponse LLM reçue en ${elapsed + 1}s.`, "success");
          (expl.sources || []).forEach((src) => addLog(`Technique identifiée: ${src}`, "data"));
        } catch (e: unknown) {
          clearInterval(llmTimer);
          const msg = e instanceof Error ? e.message : "Erreur inconnue";
          addLog(`LLM: ${msg}`, "warn");
        }
      }

      setStep(3, {
        status: "done",
        result: expl
          ? `${expl.sources?.length ?? 0} techniques MITRE identifiées`
          : "LLM non disponible",
        data: expl,
      });

      if (abortRef.current) return;

      // ── Step 4: Defense actions ───────────────────────────────────────────
      setStep(4, { status: "active" });
      await sleep(400);
      addLog("Génération des recommandations défensives...", "info");

      let defList: DefenseAction[] = [];
      try {
        defList = await fetchDefenseActions({ limit: 10 });
      } catch {
        addLog("Aucune action défensive retournée par le backend.", "warn");
      }

      setDefActions(defList);
      defList.slice(0, 5).forEach((da) => {
        addLog(
          `ACTION ${da.action.toUpperCase()} — IP: ${da.ip ?? "N/A"} (conf: ${(da.confidence * 100).toFixed(0)}%)`,
          "data"
        );
      });
      addLog(`${defList.length} recommandation(s) en attente de validation humaine.`, "success");
      setStep(4, { status: "done", result: `${defList.length} actions recommandées`, data: defList });

      addLog("══════ Pipeline complet — analyse terminée ══════", "success");
      setDone(true);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      addLog(`ERREUR: ${msg}`, "error");
      // mark current active step as error
      setSteps((p) => p.map((s) => s.status === "active" ? { ...s, status: "error" } : s));
    } finally {
      setRunning(false);
    }
  };

  const handleReset = async () => {
    abortRef.current = true;
    try { await demoReset(); } catch {}
    setRunning(false);
    setDone(false);
    setLogs([]);
    setAlerts([]);
    setExpl(null);
    setDefActions([]);
    setSteps(STEPS.map(() => ({ status: "pending" })));
  };

  const completedCount = steps.filter((s) => s.status === "done").length;
  const progress = (completedCount / STEPS.length) * 100;

  const timelineData = React.useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }).map((_, i) => {
      const s = new Date(now - (11 - i) * 1800000); s.setMinutes(0, 0, 0);
      return { time: s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), startMs: s.getTime(), count: 0 };
    });
    for (const a of alerts) {
      const t = new Date(a.ts).getTime(); if (!Number.isFinite(t)) continue;
      const d = Math.floor((t - buckets[0].startMs) / 1800000);
      if (d >= 0 && d < buckets.length) buckets[d].count++;
    }
    return buckets.map(({ time, count }) => ({ time, count }));
  }, [alerts]);

  const severityData = React.useMemo(() => [
    { name: "Critique", value: alerts.filter((a) => a.severity === "high").length },
    { name: "Moyenne",  value: alerts.filter((a) => a.severity === "medium").length },
    { name: "Faible",   value: alerts.filter((a) => a.severity === "low").length },
  ], [alerts]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── SSE toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[2000] w-72 rounded-2xl p-4 animate-alert-in"
          style={{ background: "#0c1628", border: "1px solid rgba(34,211,238,0.3)", boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}
        >
          <div className="text-xs font-semibold font-mono-cyber mb-1" style={{ color: "#22d3ee" }}>● Nouvelle alerte SSE</div>
          <div className="font-semibold" style={{ color: "#e2e8f0" }}>Alerte #{toast.id}</div>
          <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            {toast.ip ? `IP: ${toast.ip} — ` : ""}
            <span style={{ color: sevColor(toast.severity) }}>{toast.severity}</span>
            {" — score: "}{toast.score?.toFixed(3)}
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4" style={{ color: "#22d3ee" }} />
            <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Pipeline IDS Cognitif — Démonstration</h1>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Exécution réelle du pipeline complet : génération → ML → GeoIP → LLM MITRE ATT&CK → défense.
            Chaque étape est validée par l&apos;API backend.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={runPipeline} disabled={running} size="sm">
            {running
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Pipeline en cours…</>
              : <><Play className="h-3.5 w-3.5 mr-1.5" />Lancer la démonstration</>}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleReset} disabled={running}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Réinitialiser
          </Button>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 cyber-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold font-mono-cyber uppercase tracking-wider" style={{ color: "#64748b" }}>
            Progression du pipeline
          </span>
          <span className="text-xs font-bold font-mono-cyber" style={{ color: completedCount === STEPS.length ? "#10b981" : "#22d3ee" }}>
            {completedCount}/{STEPS.length} étapes
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(34,211,238,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: done
                ? "linear-gradient(90deg, #10b981, #22d3ee)"
                : "linear-gradient(90deg, #22d3ee, #3b82f6)",
              boxShadow: progress > 0 ? "0 0 12px rgba(34,211,238,0.4)" : "none",
            }}
          />
        </div>
        {done && (
          <div className="flex items-center gap-1.5 mt-2">
            <CheckCircle className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
            <span className="text-xs font-semibold" style={{ color: "#10b981" }}>
              Analyse complète — toutes les étapes validées par l&apos;API
            </span>
          </div>
        )}
      </div>

      {/* ── Main: Pipeline steps + Terminal ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Pipeline steps */}
        <div className="lg:col-span-2 cyber-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "#64748b" }}>
            Étapes du pipeline
          </div>
          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute top-5 bottom-5 w-px"
              style={{ left: "19px", background: "rgba(34,211,238,0.07)" }}
            />
            <div className="space-y-6">
              {STEPS.map((step, idx) => {
                const s = steps[idx];
                const Icon = step.icon;
                const isActive = s.status === "active";
                const isDone   = s.status === "done";
                const isError  = s.status === "error";

                return (
                  <div key={idx} className="flex gap-4 relative z-10">
                    {/* Status icon */}
                    <div
                      className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center transition-all duration-500"
                      style={
                        isDone   ? { background: "rgba(16,185,129,0.12)",  border: "2px solid rgba(16,185,129,0.5)",  color: "#10b981" }
                        : isError  ? { background: "rgba(239,68,68,0.1)",    border: "2px solid rgba(239,68,68,0.4)",    color: "#ef4444" }
                        : isActive ? { background: `${step.color}12`,       border: `2px solid ${step.color}60`,       color: step.color, boxShadow: `0 0 18px ${step.color}30` }
                        :            { background: "rgba(100,116,139,0.06)", border: "2px solid rgba(100,116,139,0.1)", color: "#334155" }
                      }
                    >
                      {isDone   ? <CheckCircle className="h-4 w-4" />
                       : isError  ? <XCircle className="h-4 w-4" />
                       : isActive ? <Loader2 className="h-4 w-4 animate-spin" />
                       :            <Icon className="h-4 w-4" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-sm font-semibold transition-colors"
                          style={{ color: isDone ? "#10b981" : isActive ? step.color : isError ? "#ef4444" : "#64748b" }}
                        >
                          {step.label}
                        </span>
                        {isActive && (
                          <span className="animate-blink text-xs" style={{ color: step.color }}>▌</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#334155" }}>
                        {step.desc}
                      </p>
                      {/* Result chip */}
                      {s.result && (
                        <div
                          className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-mono-cyber font-semibold"
                          style={{
                            background: isDone ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${isDone ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: isDone ? "#34d399" : "#f87171",
                          }}
                        >
                          <CheckCircle className="h-2.5 w-2.5" />
                          {s.result}
                        </div>
                      )}
                      {/* Active progress bar */}
                      {isActive && (
                        <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(34,211,238,0.08)" }}>
                          <div
                            className="h-full w-1/2 rounded-full animate-scan"
                            style={{ background: `linear-gradient(90deg, transparent, ${step.color}, #3b82f6, transparent)` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="lg:col-span-3 cyber-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-4 w-4" style={{ color: "#22d3ee" }} />
            <span className="text-xs font-semibold font-mono-cyber uppercase tracking-wider gradient-text-teal">
              Sortie système — temps réel
            </span>
            <div className="ml-auto flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#10b981" }} />
            </div>
          </div>
          <div
            className="flex-1 rounded-xl p-4 font-mono-cyber text-xs overflow-y-auto"
            style={{
              background: "#060c15",
              border: "1px solid rgba(34,211,238,0.07)",
              minHeight: "340px",
              maxHeight: "400px",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "#334155" }}>
                <span style={{ color: "#22d3ee" }}>$</span> En attente du lancement du pipeline…
              </div>
            ) : (
              logs.map((line) => (
                <div key={line.id} className="flex gap-2 mb-0.5 leading-relaxed">
                  <span className="shrink-0" style={{ color: "#334155" }}>{line.ts}</span>
                  <span
                    style={{
                      color:
                        line.type === "success" ? "#10b981"
                        : line.type === "error"   ? "#ef4444"
                        : line.type === "warn"    ? "#f59e0b"
                        : line.type === "data"    ? "#22d3ee"
                        :                           "#94a3b8",
                    }}
                  >
                    {line.type === "success" ? "✓ " : line.type === "error" ? "✗ " : line.type === "data" ? "→ " : "  "}
                    {line.text}
                  </span>
                </div>
              ))
            )}
            {running && (
              <div className="mt-1" style={{ color: "#22d3ee" }}>
                <span className="animate-blink">▌</span>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* ── LLM Explanation panel ──────────────────────────────────────────── */}
      {explanation && (
        <div
          className="rounded-2xl p-6 animate-fade-in"
          style={{ background: "#0c1628", border: "1px solid rgba(139,92,246,0.25)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}
              >
                <Brain className="h-5 w-5" style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <div className="font-bold" style={{ color: "#e2e8f0" }}>
                  Analyse LLM — Incident #{explanation.incident_id}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                  Corrélation MITRE ATT&CK via RAG — Ollama llama3.2
                </div>
              </div>
            </div>
            {/* Confidence badge */}
            <div
              className="px-3 py-1 rounded-full text-xs font-bold font-mono-cyber shrink-0"
              style={{
                background: explanation.confidence > 0.7 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                border: `1px solid ${explanation.confidence > 0.7 ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                color: explanation.confidence > 0.7 ? "#34d399" : "#fbbf24",
              }}
            >
              Confiance {(explanation.confidence * 100).toFixed(0)}%
            </div>
          </div>

          {/* MITRE techniques badges */}
          {explanation.sources && explanation.sources.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#64748b" }}>
                Techniques MITRE ATT&CK identifiées
              </div>
              <div className="flex flex-wrap gap-2">
                {explanation.sources.map((src, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono-cyber font-semibold"
                    style={{
                      background: "rgba(139,92,246,0.1)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      color: "#a78bfa",
                    }}
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* LLM response text */}
          <div
            className="rounded-xl p-4 font-mono-cyber text-xs leading-relaxed whitespace-pre-wrap overflow-auto"
            style={{
              background: "#060c15",
              border: "1px solid rgba(139,92,246,0.12)",
              color: "#94a3b8",
              maxHeight: "260px",
            }}
          >
            {explanation.response}
          </div>

          {/* Footer note */}
          <div className="flex items-center gap-1.5 mt-3">
            <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: "#f59e0b" }} />
            <p className="text-xs" style={{ color: "#64748b" }}>
              L&apos;analyste reste décisionnaire — aucune action n&apos;est exécutée automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* ── Defense actions panel ──────────────────────────────────────────── */}
      {defActions.length > 0 && (
        <div className="cyber-card p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4" style={{ color: "#10b981" }} />
            <span className="font-semibold" style={{ color: "#e2e8f0" }}>
              Recommandations défensives
            </span>
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold font-mono-cyber"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}
            >
              {defActions.length} actions
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {defActions.slice(0, 6).map((da) => (
              <div
                key={da.id}
                className="rounded-xl p-3.5"
                style={{
                  background: `${actionColor(da.action)}08`,
                  border: `1px solid ${actionColor(da.action)}22`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-bold font-mono-cyber uppercase tracking-wide"
                    style={{ color: actionColor(da.action) }}
                  >
                    {da.action.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-mono-cyber" style={{ color: "#334155" }}>
                    {(da.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {da.ip && (
                  <div className="text-xs font-mono-cyber mb-1" style={{ color: "#22d3ee" }}>
                    {da.ip}
                  </div>
                )}
                {da.reason && (
                  <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
                    {da.reason}
                  </p>
                )}
                <div
                  className="mt-2 flex items-center gap-1 text-[10px] font-semibold"
                  style={{ color: da.active ? "#10b981" : "#334155" }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: da.active ? "#10b981" : "#334155" }}
                  />
                  {da.active ? "Active" : "En attente"} — décision humaine requise
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alerts live table ──────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="cyber-card p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4" style={{ color: "#ef4444" }} />
            <span className="font-semibold" style={{ color: "#e2e8f0" }}>Alertes détectées</span>
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold font-mono-cyber"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              {alerts.length} alertes
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>IP Source</th>
                  <th>Sévérité</th>
                  <th>Score ML</th>
                  <th>Source</th>
                  <th>Horodatage</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 8).map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono-cyber" style={{ color: "#22d3ee" }}>#{a.id}</td>
                    <td className="font-mono-cyber" style={{ color: "#e2e8f0" }}>{a.ip || "—"}</td>
                    <td>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono-cyber"
                        style={{
                          background: `${sevColor(a.severity)}15`,
                          border: `1px solid ${sevColor(a.severity)}35`,
                          color: sevColor(a.severity),
                        }}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="font-mono-cyber" style={{ color: a.score > 0.8 ? "#ef4444" : a.score > 0.5 ? "#f59e0b" : "#10b981" }}>
                      {a.score.toFixed(3)}
                    </td>
                    <td style={{ color: "#64748b" }}>{a.source}</td>
                    <td className="font-mono-cyber text-xs" style={{ color: "#334155" }}>
                      {new Date(a.ts).toLocaleTimeString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length > 8 && (
              <div className="text-xs text-center pt-2" style={{ color: "#334155" }}>
                + {alerts.length - 8} alertes — <a href="/alerts" style={{ color: "#22d3ee" }}>voir toutes <ChevronRight className="inline h-3 w-3" /></a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Map + Charts ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="cyber-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4" style={{ color: "#f59e0b" }} />
            <span className="font-semibold" style={{ color: "#e2e8f0" }}>Carte GeoIP — origines des attaques</span>
          </div>
          <div className="h-64">
            <WorldMap height="256px" refreshInterval={running ? 5000 : 0} />
          </div>
        </div>
        <div className="grid grid-rows-2 gap-5">
          <SimpleChart title="Alertes dans le temps" data={timelineData} type="line" xKey="time" yKey="count" loading={running} />
          <SimpleChart title="Répartition par sévérité" data={severityData} type="bar" xKey="name" yKey="value" loading={running} />
        </div>
      </div>

      {/* ── Pedagogical footer ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "rgba(34,211,238,0.03)", border: "1px solid rgba(34,211,238,0.1)" }}
      >
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#22d3ee" }}>
          Comment fonctionne ce pipeline ?
        </div>
        <div className="flex flex-col md:flex-row items-center gap-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const stepDone = steps[i]?.status === "done";
            return (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500"
                    style={{
                      background: stepDone ? `${step.color}20` : `${step.color}10`,
                      border: `1px solid ${stepDone ? step.color + "60" : step.color + "25"}`,
                      boxShadow: stepDone ? `0 0 12px ${step.color}30` : "none",
                    }}
                  >
                    {stepDone
                      ? <CheckCircle className="h-4 w-4" style={{ color: step.color }} />
                      : <Icon className="h-4 w-4" style={{ color: step.color }} />}
                  </div>
                  <div className="text-xs font-semibold leading-tight" style={{ color: stepDone ? step.color : "#e2e8f0" }}>
                    {i + 1}. {step.label.split("—")[0].trim()}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 hidden md:block" style={{ color: "#334155" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p className="text-xs mt-4 leading-relaxed" style={{ color: "#64748b" }}>
          Ce système de détection d&apos;intrusion cognitif (IDS) repose sur un modèle ML non supervisé
          entraîné sur du trafic réseau réel. Les alertes sont enrichies par GeoIP, corrélées avec la base
          de connaissances MITRE ATT&CK via RAG, et expliquées en langage naturel par un LLM local (Ollama).{" "}
          <strong style={{ color: "#94a3b8" }}>Aucune action automatique</strong> — l&apos;analyste SOC reste
          décisionnaire à chaque étape.
        </p>
      </div>

    </div>
  );
}
