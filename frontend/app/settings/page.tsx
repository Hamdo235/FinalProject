"use client";
import React from "react";
import {
  fetchHealth, fetchBlockedIps, unblockIpDirect, manualBlockIp, demoReset,
} from "@/lib/api";
import { BlockedIp, HealthStatus } from "@/types/api";
import {
  Server, Database, Brain, MapPin, Shield, ShieldOff, ShieldCheck,
  RefreshCw, Terminal, Plus, Trash2, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type StatusLevel = 'ok' | 'warn' | 'error';

function StatusChip({ level, label }: { level: StatusLevel; label: string }) {
  const cfg: Record<StatusLevel, { color: string; glow: string }> = {
    ok:    { color: "#10b981", glow: "rgba(16,185,129,0.6)" },
    warn:  { color: "#f59e0b", glow: "rgba(245,158,11,0.5)" },
    error: { color: "#ef4444", glow: "rgba(239,68,68,0.6)" },
  };
  const { color, glow } = cfg[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono-cyber" style={{ color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${glow}` }} />
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
  const iconColor = level === 'ok' ? '#22d3ee' : level === 'warn' ? '#f59e0b' : '#64748b';
  return (
    <div
      className="flex flex-col gap-1 rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
          <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{label}</span>
        </div>
        <StatusChip level={level} label={chip} />
      </div>
      {hint && (
        <p className="text-[10px] font-mono-cyber pl-6" style={{ color: '#475569' }}>{hint}</p>
      )}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-[10px] font-mono-cyber px-2 py-0.5 rounded transition-all"
      style={{ background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.15)", color: copied ? "#10b981" : "#22d3ee" }}
    >
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "∞";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SettingsPage() {
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [blocked, setBlocked] = React.useState<BlockedIp[]>([]);
  const [loadingHealth, setLoadingHealth] = React.useState(true);
  const [loadingBlocked, setLoadingBlocked] = React.useState(true);
  const [unblockBusy, setUnblockBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");

  const [showManualBlock, setShowManualBlock] = React.useState(false);
  const [manualIp, setManualIp] = React.useState("");
  const [manualReason, setManualReason] = React.useState("Blocage manuel analyste");
  const [manualTtl, setManualTtl] = React.useState(30);
  const [manualBusy, setManualBusy] = React.useState(false);
  const [manualResult, setManualResult] = React.useState<{ cmd?: string; msg?: string } | null>(null);

  const [resetBusy, setResetBusy] = React.useState(false);

  const loadHealth = async () => {
    setLoadingHealth(true);
    try { setHealth(await fetchHealth()); } catch { setHealth(null); }
    finally { setLoadingHealth(false); }
  };

  const loadBlocked = async () => {
    setLoadingBlocked(true);
    try { setBlocked(await fetchBlockedIps()); } catch { setBlocked([]); }
    finally { setLoadingBlocked(false); }
  };

  React.useEffect(() => {
    loadHealth();
    loadBlocked();
    const t = setInterval(loadBlocked, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") loadBlocked(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const handleUnblock = async (ip: string) => {
    setUnblockBusy(ip);
    try {
      await unblockIpDirect(ip);
      setMsg(`IP ${ip} débloquée.`);
      loadBlocked();
    } catch { setMsg(`Erreur déblocage ${ip}.`); }
    finally { setUnblockBusy(null); }
  };

  const handleManualBlock = async () => {
    if (!manualIp.trim()) return;
    setManualBusy(true); setManualResult(null);
    try {
      const res = await manualBlockIp({ ip: manualIp, reason: manualReason, ttl_minutes: manualTtl, approved_by: "Analyste SOC" });
      setManualResult({ cmd: res.iptables_command, msg: res.message });
      setManualIp(""); loadBlocked();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setManualResult({ msg: `Erreur : ${msg}` });
    } finally { setManualBusy(false); }
  };

  const handleReset = async () => {
    setResetBusy(true);
    try { await demoReset(); setMsg("Base de données réinitialisée."); loadBlocked(); }
    catch { setMsg("Erreur lors de la réinitialisation."); }
    finally { setResetBusy(false); }
  };

  const modeColor: Record<string, string> = {
    off: "#334155", monitor: "#f59e0b", assist: "#22d3ee", auto: "#ef4444",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Paramètres</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
          État des services, défense applicative et administration.
        </p>
      </div>

      {msg && (
        <div className="text-sm font-medium px-4 py-2 rounded-xl"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
          {msg}
        </div>
      )}

      {/* ── Section 1 : État des services ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4" style={{ color: "#22d3ee" }} />
              État des services
            </span>
            <button
              onClick={loadHealth}
              className="text-xs flex items-center gap-1 transition-all"
              style={{ color: "#64748b" }}
            >
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHealth ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
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
            <Shield className="h-4 w-4" style={{ color: "#22d3ee" }} />
            Configuration défense
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm" style={{ color: "#64748b" }}>Mode actif :</span>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold font-mono-cyber uppercase tracking-wide"
              style={{
                background: `${modeColor[health?.defense_mode ?? "assist"] ?? "#22d3ee"}15`,
                border: `1px solid ${modeColor[health?.defense_mode ?? "assist"] ?? "#22d3ee"}35`,
                color: modeColor[health?.defense_mode ?? "assist"] ?? "#22d3ee",
              }}
            >
              {health?.defense_mode ?? "assist"}
            </span>
            <span className="text-[11px] font-mono-cyber" style={{ color: "#334155" }}>
              Configurable via env DEFENSE_MODE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: "#22d3ee" }} />
            <span className="text-sm" style={{ color: "#64748b" }}>
              IPs bloquées actives :
            </span>
            <span className="font-bold font-mono-cyber" style={{ color: "#ef4444" }}>
              {health?.blocked_ips_count ?? blocked.length}
            </span>
          </div>
          <div
            className="text-[11px] rounded-lg px-3 py-2"
            style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b" }}
          >
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
              <ShieldOff className="h-4 w-4" style={{ color: "#ef4444" }} />
              IPs actuellement bloquées
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono-cyber"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                {blocked.length}
              </span>
            </span>
            <button
              onClick={() => setShowManualBlock(!showManualBlock)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
              style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}
            >
              <Plus className="h-3.5 w-3.5" /> Bloquer une IP
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulaire blocage manuel */}
          {showManualBlock && (
            <div
              className="rounded-xl p-4 space-y-3 animate-fade-in"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)" }}
            >
              <div className="text-xs font-semibold" style={{ color: "#22d3ee" }}>Blocage manuel</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="rounded-lg px-3 py-1.5 text-sm font-mono-cyber col-span-1"
                  style={{ background: "#060c15", border: "1px solid rgba(34,211,238,0.2)", color: "#e2e8f0" }}
                  placeholder="IP (ex: 1.2.3.4)"
                  value={manualIp} onChange={(e) => setManualIp(e.target.value)}
                />
                <input
                  className="rounded-lg px-3 py-1.5 text-sm col-span-1 sm:col-span-2"
                  style={{ background: "#060c15", border: "1px solid rgba(34,211,238,0.2)", color: "#e2e8f0" }}
                  placeholder="Raison du blocage"
                  value={manualReason} onChange={(e) => setManualReason(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono-cyber" style={{ color: "#64748b" }}>
                  TTL : <span style={{ color: "#22d3ee" }}>{manualTtl} min</span>
                </label>
                <input
                  type="range" min={5} max={120} step={5} value={manualTtl}
                  onChange={(e) => setManualTtl(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: "#22d3ee" }}
                />
              </div>
              <button
                onClick={handleManualBlock} disabled={manualBusy || !manualIp.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
              >
                {manualBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                Bloquer l'IP
              </button>
              {manualResult && (
                <div className="space-y-1">
                  {manualResult.msg && (
                    <div className="text-xs font-mono-cyber" style={{ color: "#10b981" }}>{manualResult.msg}</div>
                  )}
                  {manualResult.cmd && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Terminal className="h-3 w-3 shrink-0" style={{ color: "#10b981" }} />
                      <span className="text-[10px] font-mono-cyber flex-1" style={{ color: "#34d399" }}>{manualResult.cmd}</span>
                      <CopyBtn text={manualResult.cmd} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table des IPs bloquées */}
          {loadingBlocked ? (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "#64748b" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : blocked.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "#334155" }}>
              <ShieldCheck className="h-8 w-8 mx-auto mb-2" style={{ color: "#10b981" }} />
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
                      <td className="font-mono-cyber text-xs px-4 py-3" style={{ color: "#22d3ee" }}>{b.ip}</td>
                      <td className="text-xs px-4 py-3" style={{ color: "#94a3b8" }}>{b.reason}</td>
                      <td className="text-xs px-4 py-3" style={{ color: "#64748b" }}>{b.approved_by}</td>
                      <td className="font-mono-cyber text-xs px-4 py-3">
                        <div className="flex items-center gap-1" style={{ color: "#f59e0b" }}>
                          <Clock className="h-3 w-3" />
                          <ExpiryCountdown expiresAt={b.expires_at} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[10px] font-mono-cyber" style={{ color: "#34d399" }}>
                            {b.iptables_command}
                          </code>
                          <CopyBtn text={b.iptables_command} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleUnblock(b.ip)}
                          disabled={unblockBusy === b.ip}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)", color: "#64748b" }}
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
            <Terminal className="h-4 w-4" style={{ color: "#64748b" }} />
            Administration système
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset} disabled={resetBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
            >
              {resetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Réinitialiser la démo (base de données)
            </button>
          </div>
          <div
            className="text-[11px] rounded-lg px-3 py-2"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", color: "#64748b" }}
          >
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
