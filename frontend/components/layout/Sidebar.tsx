"use client";
import React from "react";
import Link from "next/link";
import { LayoutDashboard, BellRing, ShieldAlert, Play, Cpu, Radar, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alertes", icon: BellRing },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/chat", label: "Chat SOC", icon: MessageCircle },
  { href: "/demo", label: "Démo", icon: Play },
  { href: "/model", label: "Modèle ML", icon: Cpu },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-slate-900/10 bg-white/60 backdrop-blur sticky top-0 h-screen self-start">
      <div className="h-16 border-b border-slate-900/10 px-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-400 flex items-center justify-center shadow-md">
          <Radar className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CyberSentinel</div>
          <div className="font-semibold text-slate-900">Command Center</div>
        </div>
      </div>
      <nav className="p-3 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-white/70"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3">
        <div className="rounded-lg border border-slate-900/10 bg-white/80 p-3 text-xs text-slate-600">
          Analyse assistée. Aucune action automatique.
        </div>
      </div>
    </aside>
  );
}
