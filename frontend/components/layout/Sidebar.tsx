"use client";
import React from "react";
import Link from "next/link";
import {
  LayoutDashboard, BellRing, ShieldAlert, Play, Cpu, MessageCircle, Radar,
  ChevronRight, LogOut, User, BarChart2, Settings, X, Mail, Phone, Briefcase,
  Calendar, Shield,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getUsername, getUserProfile, logout, type StoredUser } from "@/components/layout/AuthProvider";

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
    <aside
      className="hidden md:flex w-56 flex-col sticky top-0 h-screen self-start shrink-0"
      style={{
        background: "#060c15",
        borderRight: "1px solid rgba(34,211,238,0.08)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="h-16 px-4 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(34,211,238,0.07)" }}
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
            boxShadow: "0 0 18px rgba(34,211,238,0.35)",
          }}
        >
          <Radar style={{ height: 17, width: 17, color: "#fff" }} />
        </div>
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-bold truncate"
            style={{ color: "#22d3ee" }}
          >
            CyberSentinel
          </div>
          <div className="text-[11px] font-medium truncate" style={{ color: "#64748b" }}>
            SOC Platform
          </div>
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="px-4 pt-5 pb-1.5">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "#334155" }}
        >
          Navigation
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="px-2.5 space-y-0.5 overflow-y-auto flex-1">
        {items.map(({ href, label, icon: Icon, tag }) => {
          const active =
            pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all relative group ${active ? "nav-active" : ""}`}
              style={
                active
                  ? {}
                  : { color: "#64748b", border: "1px solid transparent" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#64748b";
                }
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium flex-1 truncate">{label}</span>
              {tag && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono-cyber"
                  style={{
                    background: active ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.07)",
                    color: active ? "#22d3ee" : "#334155",
                    border: "1px solid rgba(34,211,238,0.15)",
                  }}
                >
                  {tag}
                </span>
              )}
              {active && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "#22d3ee" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User profile card ── */}
      <div className="p-3 shrink-0 space-y-2">
        {/* System status */}
        <div className="flex items-center gap-2 px-1 pb-1">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse-badge"
            style={{ background: "#10b981" }}
          />
          <span className="text-[10px] font-semibold" style={{ color: "#334155" }}>
            Système opérationnel
          </span>
        </div>

        {/* ── Profile button ── */}
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full rounded-xl p-3 text-left transition-all group"
          style={{
            background: "rgba(34,211,238,0.04)",
            border: "1px solid rgba(34,211,238,0.08)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.2)";
            const chevron = (e.currentTarget as HTMLElement).querySelector(".profile-chevron") as HTMLElement | null;
            if (chevron) chevron.style.color = "#22d3ee";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.08)";
            const chevron = (e.currentTarget as HTMLElement).querySelector(".profile-chevron") as HTMLElement | null;
            if (chevron) chevron.style.color = "#334155";
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, #22d3ee22 0%, #3b82f622 100%)",
                border: "1px solid rgba(34,211,238,0.25)",
                color: "#22d3ee",
              }}
            >
              {username ? initials : <User style={{ width: 14, height: 14 }} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate" style={{ color: "#e2e8f0" }}>
                {username || "—"}
              </div>
              <div className="text-[10px]" style={{ color: "#334155" }}>
                {profile?.role || "Analyste SOC"}
              </div>
            </div>
            <ChevronRight className="profile-chevron" style={{ width: 12, height: 12, color: "#334155", flexShrink: 0, transition: "color 0.15s" }} />
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
            className="w-72 rounded-2xl overflow-hidden animate-slide-in-right"
            style={{ background: "#0a1220", border: "1px solid rgba(34,211,238,0.2)", boxShadow: "0 0 40px rgba(34,211,238,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(34,211,238,0.1)", background: "rgba(34,211,238,0.04)" }}>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: "#22d3ee" }} />
                <span className="text-sm font-bold font-mono-cyber" style={{ color: "#22d3ee" }}>Profil Analyste</span>
              </div>
              <button onClick={() => setProfileOpen(false)} className="rounded-lg p-1 transition-all" style={{ color: "#64748b" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Avatar + name */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.15))", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}
              >
                {username ? username.slice(0, 2).toUpperCase() : <User style={{ width: 20, height: 20 }} />}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{profile?.username || username}</p>
                <p className="text-[11px] font-mono-cyber" style={{ color: "#22d3ee" }}>{profile?.role || "Analyste SOC"}</p>
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
                <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "#475569" }} />
                  <span className="text-[10px] font-mono-cyber w-20 shrink-0" style={{ color: "#475569" }}>{label}</span>
                  <span className="text-[11px] font-medium truncate" style={{ color: value === "—" ? "#334155" : "#94a3b8" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Logout button */}
            <div className="px-4 pb-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.16)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
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
