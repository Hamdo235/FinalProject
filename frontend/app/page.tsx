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
    color: "#6BA3C9",
    bg: "#13202C",
    border: "#2A4357",
  },
  {
    href: "/alerts",
    icon: AlertTriangle,
    label: "Alertes",
    desc: "Flux temps réel, labellisation, défense.",
    color: "#D98862",
    bg: "#2A1A12",
    border: "#4D3122",
  },
  {
    href: "/incidents",
    icon: Shield,
    label: "Incidents",
    desc: "Groupement d'alertes, explication LLM.",
    color: "#E0B83A",
    bg: "#262017",
    border: "#4A3F1C",
  },
  {
    href: "/chat",
    icon: MessageCircle,
    label: "Chat SOC",
    desc: "Interroger le LLM sur l'activité en cours.",
    color: "#6BA3C9",
    bg: "#13202C",
    border: "#2A4357",
  },
  {
    href: "/demo",
    icon: Play,
    label: "Demo",
    desc: "Pipeline complet ML LLM en action.",
    color: "#6FB894",
    bg: "#15241C",
    border: "#2C4A39",
  },
  {
    href: "/model",
    icon: Cpu,
    label: "Modele ML",
    desc: "Metriques F1, precision, rappel.",
    color: "#6BA3C9",
    bg: "#13202C",
    border: "#2A4357",
  },
];

const CYCLE = [
  {
    step: "01",
    title: "Detection",
    desc: "Les logs reseau sont classes par le modele ML. Les anomalies generent des alertes avec un score de confiance.",
    color: "#6BA3C9",
    bg: "#13202C",
  },
  {
    step: "02",
    title: "Decision humaine",
    desc: "L'analyste SOC labellise les alertes (vraie attaque / faux positif) assiste par le LLM explicatif.",
    color: "#E0B83A",
    bg: "#262017",
  },
  {
    step: "03",
    title: "Apprentissage",
    desc: "Le modele est reentraine hors-ligne avec les labels valides. Le cycle s'ameliore continuellement.",
    color: "#6FB894",
    bg: "#15241C",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 animate-fade-in">

      {/* ── Hero ── */}
      <section className="relative text-center space-y-6 py-14 px-4">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(91,138,110,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-mono-cyber mb-6 bg-[#15241C] border border-[#2C4A39] text-accent-sage">
            <Radar className="h-3.5 w-3.5" />
            IDS Cognitif - 100% local, zero cloud
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span style={{ color: "#6FB894" }}>CyberSentinel</span>
            <span className="text-text-primary">-LLM</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto leading-relaxed text-text-secondary">
            Plateforme de detection d&apos;intrusion avec analyse ML, enrichissement GeoIP,
            explication LLM et correlation MITRE ATT&amp;CK. L&apos;analyste reste decisionnaire -
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
                Voir la demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Status strip ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: <Activity className="h-5 w-5 text-accent-sage" />,
            label: "Flux temps reel",
            value: "SSE actif",
            sub: "Alertes en streaming",
            color: "#6FB894", bg: "#15241C", border: "#2C4A39",
          },
          {
            icon: <Cpu className="h-5 w-5 text-accent-slate" />,
            label: "Modele ML",
            value: "RandomForest",
            sub: "Detection d'anomalies",
            color: "#6BA3C9", bg: "#13202C", border: "#2A4357",
          },
          {
            icon: <Lock className="h-5 w-5 text-[#E0B83A]" />,
            label: "Assistant LLM",
            value: "Explicatif",
            sub: "Aucune action automatique",
            color: "#E0B83A", bg: "#262017", border: "#4A3F1C",
          },
        ].map(({ icon, label, value, sub, color, bg, border }) => (
          <div key={label} className="cyber-card p-5 flex items-center gap-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              {icon}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">{label}</div>
              <div className="text-lg font-bold font-mono-cyber mt-0.5" style={{ color }}>{value}</div>
              <div className="text-xs text-text-muted">{sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Navigation cards ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4 text-text-muted">
          Acces rapide
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {NAV_CARDS.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
            <Link key={href} href={href} className="group block">
              <div className="cyber-card p-5 h-full transition-all hover:-translate-y-1">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <ArrowRight
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted"
                  />
                </div>
                <div className="font-semibold mb-1 text-text-primary">{label}</div>
                <div className="text-sm text-text-secondary">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Learning cycle ── */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Zap className="h-4 w-4 text-accent-sage" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
            Cycle adaptatif controle
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CYCLE.map(({ step, title, desc, color, bg }) => (
            <div
              key={step}
              className="cyber-card p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} />
              <div
                className="text-5xl font-bold font-mono-cyber mb-3 leading-none opacity-20"
                style={{ color }}
              >
                {step}
              </div>
              <div className="font-semibold mb-2 text-text-primary">{title}</div>
              <div className="text-sm leading-relaxed text-text-secondary">{desc}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
