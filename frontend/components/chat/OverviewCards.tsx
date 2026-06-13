"use client";
import type { Alert } from "@/types/api";
import { formatDateTimeLocal } from "@/lib/time";

const SEV_OV: Record<string, { card: string; badge: string; label: string }> = {
  high:   { card: "bg-[#2A1A12] border-[#4D3122]",  badge: "bg-[#2A1A12] border-[#4D3122] text-accent-terra", label: "CRITIQUE" },
  medium: { card: "bg-[#262017] border-[#4A3F1C]",  badge: "bg-[#262017] border-[#4A3F1C] text-[#E0B83A]",   label: "MOYENNE"  },
  low:    { card: "bg-[#15241C] border-[#2C4A39]",  badge: "bg-[#1C3025] border-[#2C4A39] text-accent-sage", label: "FAIBLE"   },
};

const ov = (s: string) => SEV_OV[s] ?? SEV_OV.low;
const scoreColor = (v: number) => v > 0.8 ? "text-accent-terra" : v > 0.5 ? "text-[#E0B83A]" : "text-accent-sage";

export default function OverviewCards({ raw }: { raw: string }) {
  let alerts: Alert[] = [];
  try { alerts = JSON.parse(raw); } catch { return <p className="text-accent-red">Données invalides.</p>; }

  if (alerts.length === 0)
    return <p className="text-text-secondary">Aucune attaque détectée pour l&apos;instant.</p>;

  return (
    <div className="space-y-2 w-full">
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-3 font-mono-cyber text-accent-terra">
        {alerts.length} attaque{alerts.length > 1 ? "s" : ""} detectee{alerts.length > 1 ? "s" : ""} - donnees ML temps reel
      </div>
      {alerts.map((a, i) => (
        <div key={a.id} className={`rounded-xl p-3 border ${ov(a.severity).card}`}>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono-cyber w-5 text-center text-text-muted">#{i + 1}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono-cyber uppercase border ${ov(a.severity).badge}`}>
                {ov(a.severity).label}
              </span>
              <span className="text-xs font-mono-cyber text-text-mono">{a.ip || "IP inconnue"}</span>
            </div>
            <span className="text-[10px] font-mono-cyber text-text-muted">
              Score ML: <span className={scoreColor(a.score)}>{a.score.toFixed(3)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pl-7 text-text-secondary">
            <span>Règle: <span className="text-text-primary">{a.rule || a.source || "N/A"}</span></span>
            <span>Statut: <span className="text-text-primary">{a.status}</span></span>
            <span>Détectée: <span className="text-text-primary">{formatDateTimeLocal(a.ts)}</span></span>
          </div>
        </div>
      ))}
      <p className="text-[10px] mt-2 text-text-muted">
        Source: API /alerts · Modèle IsolationForest/LOF — aucune action automatique
      </p>
    </div>
  );
}
