import React from "react";
import { fetchModelMetrics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  // SSR fetch (Next 14 app dir). On peut passer en client/hook si besoin de rafraîchissement auto.
  let metrics: any = null;
  try {
    metrics = await fetchModelMetrics();
  } catch (e) {
    // En cas d'erreur backend, on affiche un état pédagogique
  }

  const detector = process.env.NEXT_PUBLIC_DETECTOR || "heuristique";
  const lastRetrainAt = process.env.NEXT_PUBLIC_LAST_RETRAIN_AT || "N/A";
  const labeled = (metrics?.positives ?? 0) + (metrics?.negatives ?? 0);
  const hasLabels = labeled > 0;

  const valOrNA = (v: unknown) => {
    if (v === null || v === undefined) return "N/A";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "N/A";
    if (typeof v === "string") return v;
    return String(v);
  };

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "N/A";
    if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "N/A";
    return valOrNA(v);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Modèle de détection (ML)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Vue synthétique des paramètres et de la performance actuelle du modèle. Les décisions sont
          prises par un humain. Le LLM est strictement explicatif.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Modèle actif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{detector}</div>
            <div className="text-xs text-gray-500 mt-1">iforest / lof / hybrid</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seuil courant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{valOrNA(metrics?.threshold)}</div>
            <div className="text-xs text-gray-500 mt-1">SCORE_THRESHOLD (configurable)</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dernier réentraînement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{lastRetrainAt}</div>
            <div className="text-xs text-gray-500 mt-1">Renseigner via variable d'environnement</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>F1-score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{hasLabels ? fmt(metrics?.f1) : "N/A"}</div>
            <div className="text-xs text-gray-500 mt-1">Basé sur alertes labellisées (sinon N/A)</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Précision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{hasLabels ? fmt(metrics?.precision) : "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rappel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{hasLabels ? fmt(metrics?.recall) : "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Échantillons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{valOrNA(metrics?.samples)}</div>
            <div className="text-xs text-gray-500 mt-1">Nombre d'exemples considérés</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Labellisés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{labeled}</div>
            <div className="text-xs text-gray-500 mt-1">positifs + négatifs</div>
          </CardContent>
        </Card>
      </div>

      {metrics && !hasLabels && (
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">
              Les métriques (F1, précision, rappel) nécessitent des alertes labellisées.
              Tant que tu n'as pas labellisé des alertes (vrai/faux positif), les valeurs restent à N/A.
            </div>
          </CardContent>
        </Card>
      )}

      {!metrics && (
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">
              Impossible de récupérer les métriques du modèle. Assurez-vous que le backend est démarré et que le
              point d'API <code>/metrics/model</code> est accessible.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
