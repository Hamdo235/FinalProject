import { fetchModelMetrics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Cpu, Target, RefreshCw, BarChart2, Database, Tag, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  let metrics: any = null;
  try {
    metrics = await fetchModelMetrics();
  } catch {}

  const detector    = process.env.NEXT_PUBLIC_DETECTOR || "heuristique";
  const lastRetrain = process.env.NEXT_PUBLIC_LAST_RETRAIN_AT || "N/A";
  const labeled     = (metrics?.positives ?? 0) + (metrics?.negatives ?? 0);
  const hasLabels   = labeled > 0;

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "N/A";
    if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "N/A";
    return String(v);
  };
  const val = (v: unknown) => {
    if (v === null || v === undefined) return "N/A";
    return String(v);
  };

  const STATS = [
    {
      icon: Cpu,
      label: "Modèle actif",
      value: detector,
      sub: "iforest / lof / hybrid",
      accent: "cyan",
      color: "#22d3ee",
    },
    {
      icon: Target,
      label: "Seuil courant",
      value: val(metrics?.threshold),
      sub: "SCORE_THRESHOLD",
      accent: "blue",
      color: "#3b82f6",
    },
    {
      icon: RefreshCw,
      label: "Dernier réentraînement",
      value: lastRetrain,
      sub: "Variable d'environnement",
      accent: "amber",
      color: "#f59e0b",
    },
    {
      icon: BarChart2,
      label: "F1-score",
      value: hasLabels ? fmt(metrics?.f1) : "N/A",
      sub: "Sur alertes labellisées",
      accent: hasLabels ? "green" : "muted",
      color: hasLabels ? "#10b981" : "#334155",
    },
    {
      icon: BarChart2,
      label: "Précision",
      value: hasLabels ? fmt(metrics?.precision) : "N/A",
      sub: "Vrai positifs / prédits positifs",
      accent: hasLabels ? "green" : "muted",
      color: hasLabels ? "#10b981" : "#334155",
    },
    {
      icon: BarChart2,
      label: "Rappel",
      value: hasLabels ? fmt(metrics?.recall) : "N/A",
      sub: "Vrai positifs / positifs réels",
      accent: hasLabels ? "green" : "muted",
      color: hasLabels ? "#10b981" : "#334155",
    },
    {
      icon: Database,
      label: "Échantillons",
      value: val(metrics?.samples),
      sub: "Exemples considérés",
      accent: "blue",
      color: "#3b82f6",
    },
    {
      icon: Tag,
      label: "Labellisés",
      value: String(labeled),
      sub: `${metrics?.positives ?? 0} pos. / ${metrics?.negatives ?? 0} nég.`,
      accent: labeled > 0 ? "cyan" : "muted",
      color: labeled > 0 ? "#22d3ee" : "#334155",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Modèle de détection</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
          Métriques et configuration du modèle ML actif. Les décisions restent humaines.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value, sub, color }) => (
          <div
            key={label}
            className="cyber-card p-5 flex flex-col gap-3"
            style={{ borderColor: `${color}20` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                {label}
              </span>
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}12`, border: `1px solid ${color}22` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono-cyber" style={{ color }}>
              {value}
            </div>
            <div className="text-[11px] font-mono-cyber" style={{ color: "#334155" }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Info banners */}
      {metrics && !hasLabels && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
          <div className="text-sm" style={{ color: "#94a3b8" }}>
            Les métriques (F1, précision, rappel) nécessitent des alertes labellisées.
            Rendez-vous sur la page{" "}
            <a href="/alerts" style={{ color: "#22d3ee" }} className="underline">Alertes</a>{" "}
            pour labelliser des alertes en vrai positif ou faux positif.
          </div>
        </div>
      )}

      {!metrics && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
          <div className="text-sm" style={{ color: "#94a3b8" }}>
            Impossible de récupérer les métriques. Vérifiez que le backend est démarré
            et que <code className="font-mono-cyber text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>/metrics/model</code> est accessible.
          </div>
        </div>
      )}
    </div>
  );
}
