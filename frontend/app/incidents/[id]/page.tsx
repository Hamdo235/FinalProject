"use client";
import { useEffect, useState } from "react";
import { fetchIncident, explainIncident, labelAlert } from "@/lib/api";

type Incident = {
  id: number;
  created_at: string;
  status: string;
  summary?: string;
  risk?: string;
  confidence: number;
  related_alerts_json?: string;
};

export default function IncidentPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [llm, setLlm] = useState<{ response: string; confidence: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionMsg, setDecisionMsg] = useState<string>("");

  const recommendations = (inc: Incident | null) => {
    if (!inc) return [];
    const risk = (inc.risk || "").toLowerCase();
    if (risk === "high") {
      return [
        "Isoler temporairement l’hôte concerné du réseau.",
        "Forcer la rotation des identifiants liés aux IP/utilisateurs concernés.",
        "Analyser les journaux d’authentification et corréler avec d’autres sources.",
      ];
    }
    if (risk === "medium") {
      return [
        "Vérifier l’origine des tentatives et la réputation des IP.",
        "Mettre en place une surveillance renforcée sur l’hôte.",
        "Confirmer si l’activité correspond à un changement légitime.",
      ];
    }
    return [
      "Surveiller l’activité et garder une trace pour corrélation future.",
      "Vérifier l’exactitude des logs et de l’enrichissement IP.",
      "Ajuster le seuil si trop de faux positifs sont observés.",
    ];
  };

  useEffect(() => {
    fetchIncident(id).then(setIncident).catch(console.error);
  }, [id]);

  const relatedAlertIds = () => {
    if (!incident?.related_alerts_json) return [];
    try {
      const ids = JSON.parse(incident.related_alerts_json);
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  };

  const explain = async () => {
    setLoading(true);
    try {
      const res = await explainIncident(id);
      setLlm({ response: res.response, confidence: res.confidence });
      // refresh incident to get updated confidence
      fetchIncident(id).then(setIncident).catch(() => {});
      setMsg("Explication générée.");
    } finally {
      setLoading(false);
    }
  };

  const applyDecision = async (label: "true_attack" | "false_positive") => {
    const ids = relatedAlertIds();
    if (ids.length === 0) {
      setDecisionMsg("Aucune alerte liée à labelliser.");
      return;
    }
    setDecisionBusy(true);
    setDecisionMsg("");
    try {
      for (const aid of ids) {
        await labelAlert(aid, label);
      }
      setDecisionMsg(label === "true_attack" ? "Décision: attaque confirmée." : "Décision: faux positif.");
    } catch {
      setDecisionMsg("Erreur lors de la labellisation.");
    } finally {
      setDecisionBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Incident #{id}</h1>
      {!incident ? (
        <p>Chargement...</p>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-neutral-700">Créé le {new Date(incident.created_at).toLocaleString()}</div>
          <div className="text-sm">Statut: {incident.status} | Risque: {incident.risk} | Confiance: {incident.confidence?.toFixed(2)}</div>
          <div className="text-sm">Résumé: {incident.summary}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            <a href="/alerts" className="px-3 py-1.5 rounded border text-sm">Voir alertes</a>
            <a
              href={incident.related_alerts_json ? "/dashboard#map" : "/dashboard#map"}
              className="px-3 py-1.5 rounded border text-sm"
            >
              Voir sur la carte
            </a>
            <a href="/chat" className="px-3 py-1.5 rounded border text-sm">Discussion LLM</a>
          </div>
          <div className="p-3 border rounded bg-white">
            <div className="text-sm font-semibold mb-2">Timeline opérationnelle</div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="rounded-md border px-2 py-2 bg-emerald-50 text-emerald-700">Détection</div>
              <div className="rounded-md border px-2 py-2 bg-blue-50 text-blue-700">Enrichissement</div>
              <div className="rounded-md border px-2 py-2 bg-amber-50 text-amber-700">Incident</div>
              <div className="rounded-md border px-2 py-2 bg-purple-50 text-purple-700">
                {llm ? "LLM expliqué" : "LLM en attente"}
              </div>
              <div className="rounded-md border px-2 py-2 bg-gray-50 text-gray-700">Décision</div>
            </div>
          </div>
          <div className="p-3 border rounded bg-white">
            <div className="text-sm font-semibold mb-2">Recommandations (validation humaine requise)</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {recommendations(incident).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 border rounded bg-white">
            <div className="text-sm font-semibold mb-2">Décision humaine</div>
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                disabled={decisionBusy}
                onClick={() => applyDecision("true_attack")}
              >
                Confirmer attaque
              </button>
              <button
                className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm disabled:opacity-50"
                disabled={decisionBusy}
                onClick={() => applyDecision("false_positive")}
              >
                Marquer faux positif
              </button>
            </div>
            {decisionMsg && <div className="text-xs text-gray-600 mt-2">{decisionMsg}</div>}
          </div>
          <button onClick={explain} disabled={loading} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">
            {loading ? "Analyse LLM..." : "Demander explication LLM"}
          </button>
          {msg && <div className="text-sm text-green-700">{msg}</div>}
          {llm && (
            <div className="p-3 border rounded bg-white">
              <div className="text-sm whitespace-pre-wrap">{llm.response}</div>
              <div className="text-xs text-neutral-600 mt-1">Score de confiance (LLM): {llm.confidence.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
