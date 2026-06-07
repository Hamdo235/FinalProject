"use client";
import React from "react";
import Link from "next/link";
import {
  LayoutDashboard, BellRing, ShieldAlert, Play, Cpu, MessageCircle,
  ChevronRight, LogOut, User, BarChart2, Settings, X, Mail, Phone, Briefcase,
  Calendar, Shield,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getUsername, getUserProfile, logout, type StoredUser } from "@/components/layout/AuthProvider";
import { useRealtime } from "@/components/layout/RealtimeProvider";

const items = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard, tag: null },
  { href: "/alerts",    label: "Alertes",    icon: BellRing,         tag: "RT" },
  { href: "/incidents", label: "Incidents",  icon: ShieldAlert,      tag: null },
  { href: "/chat",      label: "Chat SOC",   icon: MessageCircle,    tag: "AI" },
  { href: "/demo",      label: "Démo",       icon: Play,             tag: null },
  { href: "/model",     label: "Modèle ML",  icon: Cpu,              tag: null },
  { href: "/reports",   label: "Rapports",   icon: BarChart2,        tag: null },
  { href: "/settings",  label: "Paramètres", icon: Settings,         tag: null },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { sseConnected, healthOk, health, pendingCount } = useRealtime();
  const [username, setUsername]     = React.useState("");
  const [profile,  setProfile]      = React.useState<StoredUser | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);

  React.useEffect(() => {
    setUsername(getUsername());
    setProfile(getUserProfile());
  }, []);

  const initials = username ? username.slice(0, 2).toUpperCase() : "?";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside className="hidden md:flex w-[260px] flex-col sticky top-0 h-screen self-start shrink-0 bg-bg-nav border-r border-bg-border">
      {/* ── Logo ── */}
      <div className="h-16 px-4 flex items-center gap-3 shrink-0 border-b border-bg-border">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-accent-sage to-[#8FCBA8] shadow-[0_2px_12px_rgba(91,138,110,0.3)]">
          <Shield className="h-[17px] w-[17px] text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold truncate text-accent-sage">
            CyberSentinel
          </div>
          <div className="text-[11px] font-medium truncate text-text-muted">
            SOC Platform
          </div>
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="px-4 pt-5 pb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Navigation
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="px-2.5 space-y-0.5 overflow-y-auto flex-1">
        {items.map(({ href, label, icon: Icon, tag }) => {
          const active =
            pathname === href || (href !== "/" && pathname?.startsWith(href));
          const showPendingBadge = href === "/alerts" && pendingCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-all relative group ${
                active
                  ? "nav-active font-semibold"
                  : "text-text-secondary hover:bg-[#1E242E] hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium flex-1 truncate">{label}</span>
              {showPendingBadge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono-cyber animate-pulse-badge bg-[#2A1A12] text-[#D98862] border border-[#4D3122] min-w-[18px] text-center"
                  title={`${pendingCount} action(s) en attente d'approbation`}
                >
                  {pendingCount}
                </span>
              )}
              {tag && !showPendingBadge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono-cyber ${
                  active
                    ? "bg-accent-sage-light text-accent-sage border border-[#2C4A39]"
                    : "bg-[#1E242E] text-text-muted border border-bg-border"
                }`}>
                  {tag}
                </span>
              )}
              {active && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-accent-sage" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User profile card ── */}
      <div className="p-3 shrink-0 space-y-2">
        {/* System status — dynamic */}
        {(() => {
          const reachable = health !== null;
          const isDegraded = reachable && !healthOk;
          const dotColor = healthOk ? "#6FB894" : isDegraded ? "#E8C547" : "#D98862";
          const statusCls = healthOk
            ? "bg-[#15241C] border-[#2C4A39] text-[#6FB894]"
            : isDegraded
              ? "bg-[#262017] border-[#4A3F1C] text-[#C9A02E]"
              : "bg-[#2A1A12] border-[#4D3122] text-[#D98862]";
          const label = healthOk
            ? "Backend connecté"
            : isDegraded
              ? "Backend dégradé"
              : "Backend injoignable";
          const tooltip = healthOk
            ? `Backend OK${sseConnected ? " — SSE actif" : " — SSE inactif"}`
            : isDegraded
              ? `Backend joignable mais dégradé : ${[
                  health?.ollama && !health.ollama.startsWith("ok") ? "Ollama" : null,
                  health?.rag_status && health.rag_status !== "ready" ? "RAG" : null,
                  health?.db && !health.db.startsWith("ok") ? "DB" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "service inconnu"}`
              : "Backend injoignable — vérifiez que l'API tourne sur le port 8000";
          return (
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${statusCls}`} title={tooltip}>
              <span className={`h-2 w-2 rounded-full shrink-0 ${reachable ? "animate-pulse-badge" : ""}`} style={{ background: dotColor }} />
              <span className="text-[10px] font-semibold flex-1">{label}</span>
              <span
                className={`text-[9px] font-mono-cyber ${sseConnected ? "text-accent-slate" : "text-text-muted"}`}
                title={sseConnected ? "Flux SSE actif" : "SSE inactif"}
              >
                {sseConnected ? "● SSE" : "○ SSE"}
              </span>
            </div>
          );
        })()}

        {/* ── Profile button ── */}
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full rounded-[10px] p-3 text-left transition-all bg-[#1C222B] border border-bg-border hover:border-[#2C4A39] hover:bg-accent-sage-light group"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-accent-sage-light border border-[#2C4A39] text-accent-sage">
              {username ? initials : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate text-text-primary">
                {username || "—"}
              </div>
              <div className="text-[10px] text-text-muted">
                {profile?.role || "Analyste SOC"}
              </div>
            </div>
            <ChevronRight className="w-3 h-3 shrink-0 text-text-muted transition-colors group-hover:text-accent-sage" />
          </div>
        </button>
      </div>

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-end md:items-center md:justify-start"
          style={{ paddingLeft: "0.75rem", paddingBottom: "0.75rem" }}
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="w-72 rounded-2xl overflow-hidden animate-slide-in-right bg-bg-card border border-bg-border shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-nav">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent-sage" />
                <span className="text-sm font-bold text-accent-sage">Profil Analyste</span>
              </div>
              <button onClick={() => setProfileOpen(false)} className="rounded-lg p-1 transition-all text-text-muted hover:text-text-primary hover:bg-bg-elevated">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Avatar + name */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 bg-accent-sage-light border border-[#2C4A39] text-accent-sage">
                {username ? username.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">{profile?.username || username}</p>
                <p className="text-[11px] text-accent-sage font-medium">{profile?.role || "Analyste SOC"}</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="px-4 pb-3 space-y-2">
              {[
                { icon: Mail,     label: "Email",    value: profile?.email     || "—" },
                { icon: Phone,    label: "Tél.",     value: profile?.phone     || "—" },
                { icon: Briefcase,label: "Rôle",     value: profile?.role      || "Analyste SOC" },
                { icon: Calendar, label: "Membre depuis", value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("fr-FR") : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-bg-elevated border border-bg-border">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="text-[10px] font-mono-cyber w-20 shrink-0 text-text-muted">{label}</span>
                  <span className={`text-[11px] font-medium truncate ${value === "—" ? "text-text-muted" : "text-text-secondary"}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Logout button */}
            <div className="px-4 pb-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold transition-all bg-[#2A1A12] border border-[#4D3122] text-[#D98862] hover:bg-[#2A1A12]"
              >
                <LogOut style={{ width: 13, height: 13 }} />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
