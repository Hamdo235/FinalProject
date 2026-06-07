"use client";
import React from "react";
import {
  unblockIpDirect, manualBlockIp, demoReset,
} from "@/lib/api";
import { getActorLabel } from "@/lib/actor";
import { parseApiDate } from "@/lib/time";
// Types fournis par le RealtimeProvider
import {
  Server, Database, Brain, MapPin, Shield, ShieldOff, ShieldCheck,
  RefreshCw, Terminal, Plus, Trash2, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRealtime } from "@/components/layout/RealtimeProvider";
import ConfirmDialog from "@/components/ConfirmDialog";

type StatusLevel = 'ok' | 'warn' | 'error';

const STATUS_CLS: Record<StatusLevel, { text: string; dot: string }> = {
  ok:    { text: "text-accent-sage",  dot: "bg-accent-sage"  },
  warn:  { text: "text-[#E0B83A]",   dot: "bg-[#E8C547]"    },
  error: { text: "text-accent-terra", dot: "bg-accent-terra" },
};

function StatusChip({ level, label }: { level: StatusLevel; label: string }) {
  const { text, dot } = STATUS_CLS[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold font-mono-cyber ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ServiceRow({
  icon: Icon, label, level, chip, hint,
}: {
  icon: React.ElementType;
  label: string;
  level: StatusLevel;
  chip: string;
  hint?: string;
}) {
  const iconCls = level === 'ok' ? 'text-accent-sage' : level === 'warn' ? 'text-[#E0B83A]' : 'text-text-secondary';
  return (
    <div className="flex flex-col gap-1 rounded-xl p-3 bg-bg-base border border-bg-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconCls}`} />
          <span className="text-sm font-medium text-text-secondary">{label}</span>
        </div>
        <StatusChip level={level} label={chip} />
      </div>
      {hint && (
        <p className="text-[10px] font-mono-cyber pl-6 text-text-muted">{hint}</p>
      )}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`text-[10px] font-mono-cyber px-2 py-0.5 rounded border transition-all ${
        copied
          ? "bg-[#15241C] border-[#2C4A39] text-accent-sage"
          : "bg-[#13202C] border-[#2A4357] text-accent-slate"
      }`}
    >
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "∞";
  const diff = parseApiDate(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SettingsPage() {
  const actorLabel = React.useMemo(() => getActorLabel(), []);
  const {
    pushToast,
    refreshPending,
    health,
    refreshHealth,
    blockedIps: blocked,
    refreshBlocked,
  } = useRealtime();
  const loadingHealth = health === null;
  const [unblockBusy, setUnblockBusy] = React.useState<string | null>(null);

  const [showManualBlock, setShowManualBlock] = React.useState(false);
  const [manualIp, setManualIp] = React.useState("");
  const [manualReason, setManualReason] = React.useState("Blocage manuel analyste");
  const [manualTtl, setManualTtl] = React.useState(30);
  const [manualBusy, setManualBusy] = React.useState(false);
  const [manualResult, setManualResult] = React.useState<{ cmd?: string; msg?: string } | null>(null);

  const [resetBusy, setResetBusy] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const loadHealth = refreshHealth;
  // No local polling: RealtimeProvider drives blockedIps via SSE + 30s safety polling.

  const handleUnblock = async (ip: string) => {
    setUnblockBusy(ip);
    try {
      await unblockIpDirect(ip);
      pushToast(`↩ IP ${ip} débloquée`, "info");
      // SSE handles the refresh, but trigger one to be reactive immediately.
      refreshBlocked();
      refreshPending();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur de déblocage ${ip} : ${m}`, "error");
    } finally { setUnblockBusy(null); }
  };

  const handleManualBlock = async () => {
    if (!manualIp.trim()) return;
    setManualBusy(true); setManualResult(null);
    try {
      const res = await manualBlockIp({ ip: manualIp, reason: manualReason, ttl_minutes: manualTtl, approved_by: actorLabel });
      setManualResult({ cmd: res.iptables_command, msg: res.message });
      pushToast(`✅ IP ${manualIp} bloquée (${manualTtl} min)`, "success");
      setManualIp(""); refreshBlocked();
      refreshPending();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Erreur inconnue";
      setManualResult({ msg: `Erreur : ${m}` });
      pushToast(`Erreur de blocage : ${m}`, "error");
    } finally { setManualBusy(false); }
  };

  const performReset = async () => {
    setResetBusy(true);
    try {
      await demoReset();
      pushToast("🗑 Base de données réinitialisée", "info");
      refreshBlocked();
      refreshPending();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(`Erreur de réinitialisation : ${m}`, "error");
    } finally {
      setResetBusy(false);
      setConfirmReset(false);
    }
  };

  const handleReset = () => setConfirmReset(true);

  const modeCls: Record<string, string> = {
    off:     "bg-bg-base border-bg-border text-text-secondary",
    monitor: "bg-[#262017] border-[#4A3F1C] text-[#E0B83A]",
    assist:  "bg-[#15241C] border-[#2C4A39] text-accent-sage",
    auto:    "bg-[#2A1A12] border-[#4D3122] text-accent-terra",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Paramètres</h1>
        <p className="text-sm mt-0.5 text-text-secondary">État des services, défense applicative et administration.</p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser la base de données ?"
        message={(
          <div className="space-y-2">
            <p>Cette opération va supprimer définitivement :</p>
            <ul className="list-disc list-inside text-xs space-y-1 text-text-secondary">
              <li>Toutes les alertes et incidents enregistrés</li>
              <li>Toutes les actions défensives (même celles approuvées)</li>
              <li>L’enrichissement GeoIP et les traces LLM</li>
              <li>La liste noire d’IP en mémoire</li>
            </ul>
            <p className="text-xs pt-1 text-accent-amber">⚠ Opération irréversible.</p>
          </div>
        )}
        confirmLabel="Réinitialiser"
        cancelLabel="Annuler"
        danger
        busy={resetBusy}
        onConfirm={performReset}
        onCancel={() => setConfirmReset(false)}
      />

      {/* ── Section 1 : État des services ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4 text-accent-slate" />
              État des services
            </span>
            <button onClick={loadHealth} className="text-xs flex items-center gap-1 transition-all text-text-secondary hover:text-text-primary">
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHealth ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ollama */}
              <ServiceRow icon={Server} label="Ollama (LLM)"
                level={health?.ollama === "ok" ? "ok" : "error"}
                chip={health?.ollama === "ok" ? "Opérationnel" : "Hors ligne"} />
              {/* SQLite */}
              <ServiceRow icon={Database} label="SQLite"
                level={health?.db === "ok" ? "ok" : "error"}
                chip={health?.db === "ok" ? "Opérationnel" : "Hors ligne"} />
              {/* RAG / ChromaDB — tri-état */}
              <ServiceRow icon={Brain} label="RAG / ChromaDB"
                level={
                  health?.rag_status === "ready"       ? "ok"
                  : health?.rag_status === "unavailable" ? "error"
                  : "warn"
                }
                chip={
                  health?.rag_status === "ready"       ? "Initialisé"
                  : health?.rag_status === "unavailable" ? "Non installé"
                  : "En attente (lazy)"
                }
                hint={
                  health?.rag_status === "pending"
                    ? "S'active au 1er appel LLM ou démo"
                    : health?.rag_status === "unavailable"
                    ? "pip install chromadb sentence-transformers"
                    : undefined
                } />
              {/* GeoLite2 */}
              <ServiceRow icon={MapPin} label="GeoLite2 (MaxMind)"
                level={health?.geolite2_present ? "ok" : "warn"}
                chip={health?.geolite2_present ? "Base présente" : "Fichier absent"}
                hint={!health?.geolite2_present ? "Définir GEOLITE2_CITY_DB dans .env" : undefined} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2 : Configuration défense ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent-sage" />
            Configuration defense
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-text-secondary">Mode actif :</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono-cyber uppercase tracking-wide border ${
              modeCls[health?.defense_mode ?? "assist"] ?? modeCls.assist
            }`}>
              {health?.defense_mode ?? "assist"}
            </span>
            <span className="text-[11px] font-mono-cyber text-text-muted">Configurable via env DEFENSE_MODE</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-accent-sage" />
            <span className="text-sm text-text-secondary">IPs bloquées actives :</span>
            <span className="font-bold font-mono-cyber text-accent-terra">{health?.blocked_ips_count ?? blocked.length}</span>
          </div>
          <div className="text-[11px] rounded-lg px-3 py-2 bg-accent-amber/[0.07] border border-accent-amber/18 text-accent-amber">
            off = désactivé · monitor = journalisation uniquement · assist = recommandations humaines ·
            auto = blocage automatique si score ≥ 0.85
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3 : IPs bloquées ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-accent-terra" />
              IPs actuellement bloquees
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono-cyber bg-[#2A1A12] border border-[#4D3122] text-accent-terra">
                {blocked.length}
              </span>
            </span>
            <button onClick={() => setShowManualBlock(!showManualBlock)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border bg-[#15241C] border-[#2C4A39] text-accent-sage hover:bg-[#1C3025]">
              <Plus className="h-3.5 w-3.5" /> Bloquer une IP
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulaire blocage manuel */}
          {showManualBlock && (
            <div className="rounded-xl p-4 space-y-3 animate-fade-in bg-[#15241C] border border-[#2C4A39]">
              <div className="text-xs font-semibold text-accent-sage">Blocage manuel</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="rounded-lg px-3 py-1.5 text-sm font-mono-cyber col-span-1 bg-bg-card border border-[#2C4A39] text-text-primary outline-none focus:border-accent-sage"
                  placeholder="IP (ex: 1.2.3.4)"
                  value={manualIp} onChange={(e) => setManualIp(e.target.value)}
                />
                <input
                  className="rounded-lg px-3 py-1.5 text-sm col-span-1 sm:col-span-2 bg-bg-card border border-[#2C4A39] text-text-primary outline-none focus:border-accent-sage"
                  placeholder="Raison du blocage"
                  value={manualReason} onChange={(e) => setManualReason(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono-cyber text-text-secondary">
                  TTL : <span className="text-accent-sage">{manualTtl} min</span>
                </label>
                <input type="range" min={5} max={120} step={5} value={manualTtl}
                  onChange={(e) => setManualTtl(Number(e.target.value))}
                  className="flex-1 accent-accent-sage"
                />
              </div>
              <button onClick={handleManualBlock} disabled={manualBusy || !manualIp.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-40 bg-[#2A1A12] border-[#4D3122] text-accent-terra hover:bg-[#35241A]">
                {manualBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                Bloquer l&apos;IP
              </button>
              {manualResult && (
                <div className="space-y-1">
                  {manualResult.msg && (
                    <div className="text-xs font-mono-cyber text-accent-sage">{manualResult.msg}</div>
                  )}
                  {manualResult.cmd && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-[#15241C] border border-[#2C4A39]">
                      <Terminal className="h-3 w-3 shrink-0 text-accent-sage" />
                      <span className="text-[10px] font-mono-cyber flex-1 text-accent-sage">{manualResult.cmd}</span>
                      <CopyBtn text={manualResult.cmd} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table des IPs bloquées */}
          {blocked.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-accent-sage" />
              Aucune IP bloquée actuellement.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Raison</th>
                    <th>Approuvé par</th>
                    <th>Expire dans</th>
                    <th>Commande iptables</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {blocked.map((b) => (
                    <tr key={b.ip}>
                      <td className="font-mono-cyber text-xs px-4 py-3 text-text-mono">{b.ip}</td>
                      <td className="text-xs px-4 py-3 text-text-secondary">{b.reason}</td>
                      <td className="text-xs px-4 py-3 text-text-secondary">{b.approved_by}</td>
                      <td className="font-mono-cyber text-xs px-4 py-3">
                        <div className="flex items-center gap-1 text-accent-amber">
                          <Clock className="h-3 w-3" />
                          <ExpiryCountdown expiresAt={b.expires_at} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[10px] font-mono-cyber text-accent-sage">{b.iptables_command}</code>
                          <CopyBtn text={b.iptables_command} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleUnblock(b.ip)}
                          disabled={unblockBusy === b.ip}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border disabled:opacity-40 bg-text-muted/[0.08] border-text-muted/22 text-text-secondary hover:bg-text-muted/[0.16]"
                        >
                          {unblockBusy === b.ip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Débloquer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4 : Commandes système ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-text-secondary" />
            Administration système
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button onClick={handleReset} disabled={resetBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 bg-accent-red/[0.08] border-accent-red/22 text-accent-red hover:bg-accent-red/[0.16]">
              {resetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Réinitialiser la démo (base de données)
            </button>
          </div>
          <div className="text-[11px] rounded-lg px-3 py-2 bg-accent-red/[0.05] border border-accent-red/12 text-text-secondary">
            ⚠ La réinitialisation supprime toutes les alertes, incidents, traces LLM et enrichissements GeoIP.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [label, setLabel] = React.useState(() => timeLeft(expiresAt));
  React.useEffect(() => {
    const t = setInterval(() => setLabel(timeLeft(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return <span>{label}</span>;
}
