"use client";
import React from "react";
import Link from "next/link";
import { LayoutDashboard, BellRing, ShieldAlert, Play, Cpu } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alertes", icon: BellRing },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/demo", label: "Démo", icon: Play },
  { href: "/model", label: "Modèle ML", icon: Cpu },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-white sticky top-0 h-screen self-start">
      <div className="h-14 border-b px-4 flex items-center font-semibold">Navigation</div>
      <nav className="p-2 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-50 text-primary-700 hover:bg-primary-100"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3 text-xs text-gray-500">
        UI d'analyse. Aucune action automatique.
      </div>
    </aside>
  );
}
