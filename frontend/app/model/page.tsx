import { fetchModelMetrics } from "@/lib/api";
import type { ModelMetrics } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Cpu, Target, RefreshCw, BarChart2, Database, Tag, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  let metrics: ModelMetrics | null = null;
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
      valCls: "text-accent-slate",
      iconCls: "bg-[#13202C] border-[#2A4357] text-accent-slate",
      topCls: "border-t-accent-slate",
    },
    {
      icon: Target,
      label: "Seuil courant",
      value: val(metrics?.threshold),
      sub: "SCORE_THRESHOLD",
      valCls: "text-accent-sage",
      iconCls: "bg-[#15241C] border-[#2C4A39] text-accent-sage",
      topCls: "border-t-accent-sage",
    },
    {
      icon: RefreshCw,
      label: "Dernier réentraînement",
      value: lastRetrain,
      sub: "Variable d'environnement",
      valCls: "text-accent-amber",
      iconCls: "bg-accent-amber/10 border-accent-amber/22 text-accent-amber",
      topCls: "border-t-accent-amber",
    },
    {
      icon: BarChart2,
      label: "F1-score",
      value: hasLabels ? fmt(metrics?.f1) : "N/A",
      sub: "Sur alertes labellisées",
      valCls: hasLabels ? "text-accent-sage" : "text-text-muted",
      iconCls: hasLabels ? "bg-[#15241C] border-[#2C4A39] text-accent-sage" : "bg-text-muted/10 border-text-muted/15 text-text-muted",
      topCls: hasLabels ? "border-t-accent-sage" : "border-t-text-muted",
    },
    {
      icon: BarChart2,
      label: "Precision",
      value: hasLabels ? fmt(metrics?.precision) : "N/A",
      sub: "Vrai positifs / predits positifs",
      valCls: hasLabels ? "text-accent-sage" : "text-text-muted",
      iconCls: hasLabels ? "bg-[#15241C] border-[#2C4A39] text-accent-sage" : "bg-text-muted/10 border-text-muted/15 text-text-muted",
      topCls: hasLabels ? "border-t-accent-sage" : "border-t-text-muted",
    },
    {
      icon: BarChart2,
      label: "Rappel",
      value: hasLabels ? fmt(metrics?.recall) : "N/A",
      sub: "Vrai positifs / positifs reels",
      valCls: hasLabels ? "text-accent-sage" : "text-text-muted",
      iconCls: hasLabels ? "bg-[#15241C] border-[#2C4A39] text-accent-sage" : "bg-text-muted/10 border-text-muted/15 text-text-muted",
      topCls: hasLabels ? "border-t-accent-sage" : "border-t-text-muted",
    },
    {
      icon: Database,
      label: "Échantillons",
      value: val(metrics?.samples),
      sub: "Exemples considérés",
      valCls: "text-accent-sage",
      iconCls: "bg-[#15241C] border-[#2C4A39] text-accent-sage",
      topCls: "border-t-accent-sage",
    },
    {
      icon: Tag,
      label: "Labellisés",
      value: String(labeled),
      sub: `${metrics?.positives ?? 0} pos. / ${metrics?.negatives ?? 0} nég.`,
      valCls: labeled > 0 ? "text-accent-slate" : "text-text-muted",
      iconCls: labeled > 0 ? "bg-[#13202C] border-[#2A4357] text-accent-slate" : "bg-text-muted/10 border-text-muted/15 text-text-muted",
      topCls: labeled > 0 ? "border-t-accent-slate" : "border-t-text-muted",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Modèle de détection</h1>
        <p className="text-sm mt-0.5 text-text-secondary">Métriques et configuration du modèle ML actif. Les décisions restent humaines.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value, sub, valCls, iconCls, topCls }) => (
          <div key={label} className={`cyber-card p-5 flex flex-col gap-3 border-t-2 transition-shadow hover:ring-1 hover:ring-[#2C4A39] ${topCls}`}>
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary">{label}</span>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center border ${iconCls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-bold font-mono-cyber ${valCls}`}>{value}</div>
            <div className="text-[11px] font-mono-cyber text-text-muted">{sub}</div>
          </div>
        ))}
      </div>

      {/* Info banners */}
      {metrics && !hasLabels && (
        <div className="rounded-2xl p-4 flex items-start gap-3 bg-accent-amber/[0.07] border border-accent-amber/22">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-accent-amber" />
          <div className="text-sm text-text-secondary">
            Les métriques (F1, précision, rappel) nécessitent des alertes labellisées.
            Rendez-vous sur la page{" "}
            <a href="/alerts" className="underline text-accent-sage hover:text-[#5CA37F]">Alertes</a>{" "}
            pour labelliser des alertes en vrai positif ou faux positif.
          </div>
        </div>
      )}

      {!metrics && (
        <div className="rounded-2xl p-4 flex items-start gap-3 bg-accent-red/[0.07] border border-accent-red/22">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-accent-red" />
          <div className="text-sm text-text-secondary">
            Impossible de récupérer les métriques. Vérifiez que le backend est démarré
            et que <code className="font-mono-cyber text-xs px-1.5 py-0.5 rounded bg-[#2A1A12] text-accent-terra">/metrics/model</code> est accessible.
          </div>
        </div>
      )}
    </div>
  );
}
