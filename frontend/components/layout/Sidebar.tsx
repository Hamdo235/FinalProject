"use client";
import React from "react";
import Link from "next/link";
import { LayoutDashboard, BellRing, ShieldAlert, Play, Cpu, Radar, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/alerts",    label: "Alertes",    icon: BellRing },
  { href: "/incidents", label: "Incidents",  icon: ShieldAlert },
  { href: "/chat",      label: "Chat SOC",   icon: MessageCircle },
  { href: "/demo",      label: "Démo",       icon: Play },
  { href: "/model",     label: "Modèle ML",  icon: Cpu },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="hidden md:flex w-64 flex-col sticky top-0 h-screen self-start"
      style={{
        background: "#080c18",
        borderRight: "1px solid rgba(0, 212, 255, 0.12)",
      }}
    >
      {/* Logo */}
      <div
        className="h-16 px-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(0, 212, 255, 0.12)" }}
      >
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center glow-cyan"
          style={{ background: "linear-gradient(135deg, #00d4ff 0%, #0080ff 100%)" }}
        >
          <Radar className="h-5 w-5 text-black" />
        </div>
        <div>
          <div
            className="text-xs uppercase tracking-[0.2em] font-semibold"
            style={{ color: "#00d4ff", letterSpacing: "0.18em" }}
          >
            CyberSentinel
          </div>
          <div className="text-xs font-medium" style={{ color: "#64748b" }}>
            Command Center
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                active ? "" : "hover:bg-[rgba(0,212,255,0.06)]"
              )}
              style={
                active
                  ? {
                      background: "rgba(0, 212, 255, 0.1)",
                      color: "#00d4ff",
                      border: "1px solid rgba(0, 212, 255, 0.25)",
                      boxShadow: "inset 0 0 12px rgba(0, 212, 255, 0.05)",
                    }
                  : { color: "#64748b" }
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full animate-pulse-badge"
                  style={{ background: "#00d4ff" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3">
        <div
          className="rounded-lg p-3 text-xs"
          style={{
            background: "rgba(0, 212, 255, 0.04)",
            border: "1px solid rgba(0, 212, 255, 0.1)",
            color: "#64748b",
          }}
        >
          Analyse assistée par IA.
          <br />
          Aucune action automatique.
        </div>
      </div>
    </aside>
  );
}
