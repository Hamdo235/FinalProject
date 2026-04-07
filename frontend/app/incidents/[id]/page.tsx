"use client";
import { use, useEffect, useState } from "react";
import { fetchIncident, explainIncident, labelAlert } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  ArrowLeft, Shield, CheckCircle, Clock, AlertTriangle,
  Brain, MapPin, MessageCircle, BellRing, ChevronRight,
  Loader2,
} from "lucide-react";

type Incident = {
  id: number;
  created_at: string;
  status: string;
  summary?: string;
  risk?: string;
  confidence: number;
  related_alerts_json?: string;
};

const TIMELINE_STEPS = [
  { label: "Détection",      color: "#22d3ee" },
  { label: "Enrichissement", color: "#3b82f6" },
  { label: "Incident",       color: "#f59e0b" },
  { label: "LLM",            color: "#10b981" },
  { label: "Décision",       color: "#ef4444" },
];

function getRecommendations(incident: Incident) {
  const risk = (incident.risk || "").toLowerCase();
  if (risk === "high") return [
    "Isoler temporairement l'hôte concerné du réseau.",
    "Forcer la rotation des identifiants liés aux IP/utilisateurs concernés.",
    "Analyser les journaux d'authentification et corréler avec d'autres sources.",
  ];
  if (risk === "medium") return [
    "Vérifier l'origine des tentatives et la réputation des IP.",
    "Mettre en place une surveillance renforcée sur l'hôte.",
    "Confirmer si l'activité correspond à un changement légitime.",
  ];
  return [
    "Surveiller l'activité et garder une trace pour corrélation future.",
    "Vérifier l'exactitude des logs et de l'enrichissement IP.",
    "Ajuster le seuil si trop de faux positifs sont observés.",
  ];
}

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const [incident, setIncident]     = useState<Incident | null>(null);
  const [llm, setLlm]               = useState<{ response: string; confidence: number } | null>(null);
  const [loading, setLoading]       = useState(false);
  const [llmElapsed, setLlmElapsed] = useState(0);
  const [msg, setMsg]               = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionMsg, setDecisionMsg]   = useState("");

  useEffect(() => {
    fetchIncident(id).then(setIncident).catch(console.error);
  }, [id]);

  const relatedAlertIds = (): number[] => {
    if (!incident?.related_alerts_json) return [];
    try { const ids = JSON.parse(incident.related_alerts_json); return Array.isArray(ids) ? ids : []; }
    catch { return []; }
  };

  const explain = async () => {
    setLoading(true); setMsg(""); setLlmElapsed(0);
    const timer = setInterval(() => setLlmElapsed((s) => s + 1), 1_000);
    try {
      const res = await explainIncident(id);
      setLlm({ response: res.response, confidence: res.confidence });
      fetchIncident(id).then(setIncident).catch(() => {});
      setMsg("Explication générée avec succès.");
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Erreur lors de la génération LLM.";
      setMsg(m);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const applyDecision = async (label: "true_attack" | "false_positive") => {
    const ids = relatedAlertIds();
    if (!ids.length) { setDecisionMsg("Aucune alerte liée à labelliser."); return; }
    setDecisionBusy(true); setDecisionMsg("");
    try {
      for (const aid of ids) await labelAlert(aid, label);
      setDecisionMsg(label === "true_attack" ? "Attaque confirmée." : "Marqué comme faux positif.");
    } catch { setDecisionMsg("Erreur lors de la labellisation."); }
    finally { setDecisionBusy(false); }
  };

  const isOpen  = incident?.status === "open";
  const risk    = (incident?.risk || "").toLowerCase();
  const riskColor =
    risk === "high"   ? "#ef4444" :
    risk === "medium" ? "#f59e0b" :
    "#10b981";
  const confidence = incident ? (incident.confidence * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
        <Link href="/incidents" className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Incidents
        </Link>
        <ChevronRight className="h-3.5 w-3.5" style={{ color: "#334155" }} />
        <span style={{ color: "#e2e8f0" }}>Incident #{id}</span>
      </div>

      {!incident ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#22d3ee" }} />
          <span style={{ color: "#64748b" }}>Chargement…</span>
        </div>
      ) : (
        <>
          {/* ── Header card ── */}
          <Card style={{ borderColor: isOpen ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.15)" }}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isOpen ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                      border: `1px solid ${isOpen ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)"}`,
                    }}
                  >
                    <Shield className="h-5 w-5" style={{ color: isOpen ? "#f59e0b" : "#10b981" }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
                      Incident #{incident.id}
                    </h1>
                    <div className="text-sm mt-0.5 font-mono-cyber" style={{ color: "#64748b" }}>
                      {new Date(incident.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={isOpen ? "warning" : "success"} className="flex items-center gap-1">
                    {isOpen ? <Clock className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                    {incident.status}
                  </Badge>
                  {incident.risk && (
                    <span
                      className="cyber-badge font-mono-cyber"
                      style={{
                        background: `${riskColor}12`,
                        color: riskColor,
                        border: `1px solid ${riskColor}30`,
                      }}
                    >
                      Risque {incident.risk}
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "#64748b" }}>Score de confiance</span>
                  <span className="text-sm font-bold font-mono-cyber" style={{ color: riskColor }}>
                    {confidence}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${confidence}%`,
                      background: `linear-gradient(90deg, ${riskColor}99, ${riskColor})`,
                      boxShadow: `0 0 8px ${riskColor}50`,
                    }}
                  />
                </div>
              </div>

              {incident.summary && (
                <p className="mt-4 text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                  {incident.summary}
                </p>
              )}

              {/* Quick links */}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/alerts">
                  <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                    <BellRing className="h-3.5 w-3.5" /> Alertes liées
                  </Button>
                </Link>
                <Link href="/dashboard#map">
                  <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Carte
                  </Button>
                </Link>
                <Link href="/chat">
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Chat SOC
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* ── Timeline ── */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline opérationnelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-0 overflow-x-auto">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isDone = idx < (llm ? 4 : 3);
                  const isActive = idx === (llm ? 4 : 3);
                  return (
                    <div key={step.label} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-cyber shrink-0"
                          style={
                            isDone
                              ? { background: `${step.color}15`, border: `2px solid ${step.color}50`, color: step.color }
                              : isActive
                              ? { background: `${step.color}18`, border: `2px solid ${step.color}`, color: step.color, boxShadow: `0 0 12px ${step.color}30` }
                              : { background: "rgba(100,116,139,0.06)", border: "2px solid rgba(100,116,139,0.12)", color: "#334155" }
                          }
                        >
                          {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : idx + 1}
                        </div>
                        <span className="text-[10px] text-center font-mono-cyber whitespace-nowrap"
                          style={{ color: isDone || isActive ? step.color : "#334155" }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <div className="h-px flex-1 mx-1 mb-4" style={{ background: isDone ? `${step.color}40` : "rgba(255,255,255,0.04)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Recommendations ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: riskColor }} />
                Recommandations
                <span className="text-xs font-normal ml-1" style={{ color: "#64748b" }}>— validation humaine requise</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getRecommendations(incident).map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span
                      className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: riskColor }}
                    />
                    <span className="text-sm" style={{ color: "#94a3b8" }}>{rec}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Human decision ── */}
          <Card>
            <CardHeader>
              <CardTitle>Décision humaine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm" style={{ color: "#64748b" }}>
                Labellise les {relatedAlertIds().length} alerte{relatedAlertIds().length !== 1 ? "s" : ""} liée{relatedAlertIds().length !== 1 ? "s" : ""} à cet incident.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={decisionBusy}
                  onClick={() => applyDecision("true_attack")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Confirmer attaque
                </button>
                <button
                  disabled={decisionBusy}
                  onClick={() => applyDecision("false_positive")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#10b981",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.15)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.08)"; }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Faux positif
                </button>
              </div>
              {decisionMsg && (
                <div
                  className="text-sm px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(34,211,238,0.07)",
                    border: "1px solid rgba(34,211,238,0.15)",
                    color: "#22d3ee",
                  }}
                >
                  {decisionMsg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── LLM Explanation ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-4 w-4" style={{ color: "#22d3ee" }} />
                Explication LLM + RAG MITRE ATT&amp;CK
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={explain}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ollama génère… {llmElapsed}s
                  </>
                ) : (
                  <><Brain className="h-4 w-4" /> Demander l&apos;explication</>
                )}
              </Button>

              {msg && (
                <div
                  className="text-sm px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(16,185,129,0.07)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    color: "#10b981",
                  }}
                >
                  {msg}
                </div>
              )}

              {llm && (
                <div
                  className="rounded-2xl p-5 space-y-4"
                  style={{
                    background: "#060c15",
                    border: "1px solid rgba(34,211,238,0.1)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold font-mono-cyber"
                      style={{ color: "#22d3ee" }}
                    >
                      Réponse LLM
                    </div>
                    <span
                      className="cyber-badge font-mono-cyber"
                      style={{
                        background: "rgba(34,211,238,0.08)",
                        color: "#22d3ee",
                        border: "1px solid rgba(34,211,238,0.2)",
                      }}
                    >
                      confiance {(llm.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "#94a3b8" }}
                  >
                    {llm.response}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
