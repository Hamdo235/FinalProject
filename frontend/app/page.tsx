"use client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  Activity, AlertTriangle, Shield, Play, BarChart3,
  MessageCircle, Cpu, ArrowRight, Radar, Zap, Lock,
} from "lucide-react";

const NAV_CARDS = [
  {
    href: "/dashboard",
    icon: BarChart3,
    label: "Dashboard",
    desc: "Vue d'ensemble, KPI, timeline, carte GeoIP.",
    color: "#22d3ee",
  },
  {
    href: "/alerts",
    icon: AlertTriangle,
    label: "Alertes",
    desc: "Flux temps réel, labellisation, défense.",
    color: "#ef4444",
  },
  {
    href: "/incidents",
    icon: Shield,
    label: "Incidents",
    desc: "Groupement d'alertes, explication LLM.",
    color: "#f59e0b",
  },
  {
    href: "/chat",
    icon: MessageCircle,
    label: "Chat SOC",
    desc: "Interroger le LLM sur l'activité en cours.",
    color: "#22d3ee",
  },
  {
    href: "/demo",
    icon: Play,
    label: "Démo",
    desc: "Pipeline complet ML → LLM en action.",
    color: "#10b981",
  },
  {
    href: "/model",
    icon: Cpu,
    label: "Modèle ML",
    desc: "Métriques F1, précision, rappel.",
    color: "#3b82f6",
  },
];

const CYCLE = [
  {
    step: "01",
    title: "Détection",
    desc: "Les logs réseau sont classifiés par le modèle ML. Les anomalies génèrent des alertes avec un score de confiance.",
    color: "#22d3ee",
  },
  {
    step: "02",
    title: "Décision humaine",
    desc: "L'analyste SOC labellise les alertes (vraie attaque / faux positif) assisté par le LLM explicatif.",
    color: "#f59e0b",
  },
  {
    step: "03",
    title: "Apprentissage",
    desc: "Le modèle est réentraîné hors-ligne avec les labels validés. Le cycle s'améliore continuellement.",
    color: "#10b981",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 animate-fade-in">

      {/* ── Hero ── */}
      <section className="relative text-center space-y-6 py-14 px-4">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34,211,238,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-mono-cyber mb-6"
            style={{
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.2)",
              color: "#22d3ee",
            }}
          >
            <Radar className="h-3.5 w-3.5 animate-pulse-cyan" />
            IDS Cognitif — 100% local, zéro cloud
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="gradient-text-teal">CyberSentinel</span>
            <span style={{ color: "#e2e8f0" }}>‑LLM</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>
            Plateforme de détection d&apos;intrusion avec analyse ML, enrichissement GeoIP,
            explication LLM et corrélation MITRE ATT&amp;CK. L&apos;analyste reste décisionnaire —
            aucune action automatique.
          </p>

          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            <Link href="/dashboard">
              <Button size="lg" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Voir la démo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Status strip ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: <Activity className="h-5 w-5" style={{ color: "#10b981" }} />,
            label: "Flux temps réel",
            value: "SSE actif",
            sub: "Alertes en streaming",
            color: "#10b981",
          },
          {
            icon: <Cpu className="h-5 w-5" style={{ color: "#3b82f6" }} />,
            label: "Modèle ML",
            value: "RandomForest",
            sub: "Détection d'anomalies",
            color: "#3b82f6",
          },
          {
            icon: <Lock className="h-5 w-5" style={{ color: "#f59e0b" }} />,
            label: "Assistant LLM",
            value: "Explicatif",
            sub: "Aucune action automatique",
            color: "#f59e0b",
          },
        ].map(({ icon, label, value, sub, color }) => (
          <div
            key={label}
            className="cyber-card p-5 flex items-center gap-4"
            style={{ borderColor: `${color}20` }}
          >
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}12`, border: `1px solid ${color}25` }}
            >
              {icon}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#334155" }}>
                {label}
              </div>
              <div className="text-lg font-bold font-mono-cyber mt-0.5" style={{ color }}>
                {value}
              </div>
              <div className="text-xs" style={{ color: "#334155" }}>{sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Navigation cards ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>
          Accès rapide
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {NAV_CARDS.map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href} className="group block">
              <div
                className="cyber-card p-5 h-full transition-all"
                style={{ borderColor: "rgba(34,211,238,0.08)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}15`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.08)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}12`, border: `1px solid ${color}22` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <ArrowRight
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color }}
                  />
                </div>
                <div className="font-semibold mb-1" style={{ color: "#e2e8f0" }}>{label}</div>
                <div className="text-sm" style={{ color: "#64748b" }}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Learning cycle ── */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Zap className="h-4 w-4" style={{ color: "#22d3ee" }} />
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
            Cycle adaptatif contrôlé
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CYCLE.map(({ step, title, desc, color }) => (
            <div
              key={step}
              className="cyber-card p-5 relative overflow-hidden"
              style={{ borderColor: `${color}18` }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: color, opacity: 0.6 }}
              />
              <div
                className="text-5xl font-bold font-mono-cyber mb-3 opacity-10 leading-none"
                style={{ color }}
              >
                {step}
              </div>
              <div className="font-semibold mb-2" style={{ color: "#e2e8f0" }}>{title}</div>
              <div className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
