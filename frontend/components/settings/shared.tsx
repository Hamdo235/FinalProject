"use client";
import React from "react";
import { parseApiDate } from "@/lib/time";

export type StatusLevel = 'ok' | 'warn' | 'error';

const STATUS_CLS: Record<StatusLevel, { text: string; dot: string }> = {
  ok:    { text: "text-accent-sage",  dot: "bg-accent-sage"  },
  warn:  { text: "text-[#E0B83A]",   dot: "bg-[#E8C547]"    },
  error: { text: "text-accent-terra", dot: "bg-accent-terra" },
};

export function StatusChip({ level, label }: { level: StatusLevel; label: string }) {
  const { text, dot } = STATUS_CLS[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold font-mono-cyber ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function ServiceRow({
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
      {hint && <p className="text-[10px] font-mono-cyber pl-6 text-text-muted">{hint}</p>}
    </div>
  );
}

export function CopyBtn({ text }: { text: string }) {
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

export function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "∞";
  const diff = parseApiDate(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [label, setLabel] = React.useState(() => timeLeft(expiresAt));
  React.useEffect(() => {
    const t = setInterval(() => setLabel(timeLeft(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return <span>{label}</span>;
}
