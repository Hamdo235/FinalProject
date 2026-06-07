"use client";
import { use, useEffect, useState } from "react";
import { fetchIncident, explainIncident, labelAlert } from "@/lib/api";
import type { Incident } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  ArrowLeft, Shield, CheckCircle, Clock, AlertTriangle,
  Brain, MapPin, MessageCircle, BellRing, ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDateTimeLocal } from "@/lib/time";

function parseLlmView(llm: { response: string; confidence: number; parsed?: Record<string, unknown> }) {
  const fromText = (): Record<string, unknown> | null => {
    const raw = (llm.response || "").trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const payload = llm.parsed ?? fromText();
  if (!payload) {
    return {
      attackType: undefined,
      mitreTechnique: undefined,
      mitreName: undefined,
      summary: llm.response,
      actions: [] as string[],
    };
  }

  const actionsRaw = payload.recommended_actions;
  const actions = Array.isArray(actionsRaw)
    ? actionsRaw.map((x) => String(x)).filter(Boolean)
    : [];

  return {
    attackType: payload.attack_type ? String(payload.attack_type) : undefined,
    mitreTechnique: payload.mitre_technique ? String(payload.mitre_technique) : undefined,
    mitreName: payload.mitre_name ? String(payload.mitre_name) : undefined,
    summary: payload.explanation ? String(payload.explanation) : llm.response,
    actions,
  };
}

const TIMELINE_STEPS = [
  { label: "Detection",      activeCls: "bg-[#13202C] border-accent-slate  text-accent-slate",  doneCls: "bg-[#1A2C3A] border-[#2A4357] text-accent-slate",  lineCls: "bg-[#2A4357]" },
  { label: "Enrichissement", activeCls: "bg-[#15241C] border-accent-sage   text-accent-sage",   doneCls: "bg-[#1C3025] border-[#2C4A39] text-accent-sage",   lineCls: "bg-[#2C4A39]" },
  { label: "Incident",       activeCls: "bg-[#262017] border-[#E8C547]    text-[#E0B83A]",      doneCls: "bg-[#262017] border-[#4A3F1C] text-[#E0B83A]",      lineCls: "bg-[#4A3F1C]" },
  { label: "LLM",            activeCls: "bg-[#15241C] border-accent-sage   text-accent-sage",   doneCls: "bg-[#1C3025] border-[#2C4A39] text-accent-sage",   lineCls: "bg-[#2C4A39]" },
  { label: "Decision",       activeCls: "bg-[#2A1A12] border-[#4D3122]    text-accent-terra",   doneCls: "bg-[#35241A] border-[#4D3122] text-accent-terra",   lineCls: "bg-[#4D3122]" },
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
  const [llm, setLlm]               = useState<{ response: string; confidence: number; parsed?: Record<string, unknown> } | null>(null);
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
      setLlm({ response: res.response, confidence: res.confidence, parsed: res.parsed });
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
  const riskTextCls = risk === "high" ? "text-accent-terra" : risk === "medium" ? "text-[#E0B83A]" : "text-accent-sage";
  const riskBadgeCls = risk === "high"
    ? "bg-[#2A1A12] text-accent-terra border-[#4D3122]"
    : risk === "medium"
    ? "bg-[#262017] text-[#E0B83A] border-[#4A3F1C]"
    : "bg-[#15241C] text-accent-sage border-[#2C4A39]";
  const confidence = incident ? (incident.confidence * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/incidents" className="flex items-center gap-1.5 hover:text-text-primary transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />Incidents
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-text-primary">Incident #{id}</span>
      </div>

      {!incident ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent-sage" />
          <span className="text-text-secondary">Chargement…</span>
        </div>
      ) : (
        <>
          {/* ── Header card ── */}
          <Card accentColor={isOpen ? "amber" : "teal"}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    isOpen ? "bg-[#262017] border-[#4A3F1C]" : "bg-[#15241C] border-[#2C4A39]"
                  }`}>
                    <Shield className={`h-5 w-5 ${isOpen ? "text-[#E0B83A]" : "text-accent-sage"}`} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-text-primary">Incident #{incident.id}</h1>
                    <div className="text-sm mt-0.5 font-mono-cyber text-text-secondary">
                      {formatDateTimeLocal(incident.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={isOpen ? "warning" : "success"} className="flex items-center gap-1">
                    {isOpen ? <Clock className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                    {incident.status}
                  </Badge>
                  {incident.risk && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] font-mono border ${riskBadgeCls}`}>
                      Risque {incident.risk}
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-secondary">Score de confiance</span>
                  <span className={`text-sm font-bold font-mono-cyber ${riskTextCls}`}>{confidence}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${
                      risk === "high" ? "bg-accent-terra" : risk === "medium" ? "bg-[#E8C547]" : "bg-accent-sage"
                    }`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>

              {incident.summary && (
                <p className="mt-4 text-sm leading-relaxed text-text-secondary">{incident.summary}</p>
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
                  const dotCls = isDone ? step.doneCls : isActive ? step.activeCls : "bg-text-muted/[0.06] border-text-muted/12 text-text-muted";
                  return (
                    <div key={step.label} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-cyber shrink-0 border-2 ${dotCls}`}>
                          {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : idx + 1}
                        </div>
                        <span className={`text-[10px] text-center font-mono-cyber whitespace-nowrap ${
                          isDone || isActive ? dotCls.split(" ").find(c => c.startsWith("text-")) : "text-text-muted"
                        }`}>{step.label}</span>
                      </div>
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <div className={`h-px flex-1 mx-1 mb-4 ${isDone ? step.lineCls : "bg-bg-border"}`} />
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
                <AlertTriangle className={`h-4 w-4 ${riskTextCls}`} />
                Recommandations
                <span className="text-xs font-normal ml-1 text-text-secondary">— validation humaine requise</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getRecommendations(incident).map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-bg-base border border-bg-border">
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                      risk === "high" ? "bg-accent-terra" : risk === "medium" ? "bg-[#E8C547]" : "bg-accent-sage"
                    }`} />
                    <span className="text-sm text-text-secondary">{rec}</span>
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
              <p className="text-sm text-text-secondary">
                Labellise les {relatedAlertIds().length} alerte{relatedAlertIds().length !== 1 ? "s" : ""} liée{relatedAlertIds().length !== 1 ? "s" : ""} à cet incident.
              </p>
              <div className="flex flex-wrap gap-3">
                <button disabled={decisionBusy} onClick={() => applyDecision("true_attack")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border disabled:opacity-40 bg-[#2A1A12] border-[#4D3122] text-accent-terra hover:bg-[#35241A]">
                  <AlertTriangle className="h-4 w-4" />Confirmer attaque
                </button>
                <button disabled={decisionBusy} onClick={() => applyDecision("false_positive")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border disabled:opacity-40 bg-[#15241C] border-[#2C4A39] text-accent-sage hover:bg-[#1C3025]">
                  <CheckCircle className="h-4 w-4" />Faux positif
                </button>
              </div>
              {decisionMsg && (
                <div className="text-sm px-3 py-2 rounded-xl bg-[#15241C] border border-[#2C4A39] text-accent-sage">
                  {decisionMsg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── LLM Explanation ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent-sage" />
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
                <div className="text-sm px-3 py-2 rounded-xl bg-[#15241C] border border-[#2C4A39] text-accent-sage">
                  {msg}
                </div>
              )}

              {llm && (
                <div className="rounded-2xl p-5 space-y-4 bg-[#15241C] border border-[#2C4A39]">
                  {(() => {
                    const view = parseLlmView(llm);
                    return (
                      <>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest font-bold font-mono-cyber text-accent-sage">
                      Reponse LLM
                    </div>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold font-mono border bg-bg-card text-accent-sage border-[#2C4A39]">
                      confiance {(llm.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  {(view.attackType || view.mitreTechnique) && (
                    <div className="flex flex-wrap gap-2">
                      {view.attackType && (
                        <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#2A1A12] text-accent-terra border border-[#4D3122]">{view.attackType}</span>
                      )}
                      {view.mitreTechnique && (
                        <span className="px-2 py-1 rounded-lg text-xs font-mono-cyber bg-[#13202C] text-accent-slate border border-[#2A4357]">
                          {view.mitreTechnique}{view.mitreName ? ` - ${view.mitreName}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-sm leading-relaxed text-text-secondary">{view.summary}</div>
                  {view.actions.length > 0 && (
                    <ul className="space-y-1.5 text-sm">
                      {view.actions.map((action, idx) => (
                        <li key={`${action}-${idx}`} className="flex items-start gap-2 text-text-secondary">
                          <span className="text-accent-sage">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
