"use client";
import { useEffect, useState } from "react";
import { fetchIncident, explainIncident } from "@/lib/api";

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

  useEffect(() => {
    fetchIncident(id).then(setIncident).catch(console.error);
  }, [id]);

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
