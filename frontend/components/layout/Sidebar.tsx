"use client";
import React from "react";
import Link from "next/link";
import {
  LayoutDashboard, BellRing, ShieldAlert, Play, Cpu, MessageCircle, Radar,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard, tag: null },
  { href: "/alerts",    label: "Alertes",    icon: BellRing,         tag: "RT" },
  { href: "/incidents", label: "Incidents",  icon: ShieldAlert,      tag: null },
  { href: "/chat",      label: "Chat SOC",   icon: MessageCircle,    tag: "AI" },
  { href: "/demo",      label: "Démo",       icon: Play,             tag: null },
  { href: "/model",     label: "Modèle ML",  icon: Cpu,              tag: null },
];

export default function Sidebar() {
  const pathname = usePathname();

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

      {/* ── Status card ── */}
      <div className="p-3 shrink-0">
        <div
          className="rounded-xl p-3 space-y-2"
          style={{
            background: "rgba(34,211,238,0.04)",
            border: "1px solid rgba(34,211,238,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse-badge"
              style={{ background: "#10b981" }}
            />
            <span className="text-[11px] font-semibold" style={{ color: "#10b981" }}>
              Système opérationnel
            </span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: "#334155" }}>
            Analyse IA assistée. Aucune action automatique.
          </div>
        </div>
      </div>
    </aside>
  );
}
