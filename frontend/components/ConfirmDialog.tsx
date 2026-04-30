"use client";
import React from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Enter" && !busy) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;
  const accent = danger ? "#ef4444" : "#22d3ee";

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => (!busy ? onCancel() : undefined)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
        style={{
          background: "#0a1220",
          border: `1px solid ${accent}40`,
          boxShadow: `0 12px 48px rgba(0,0,0,0.7), 0 0 32px ${accent}22`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: `1px solid ${accent}22`, background: `${accent}0a` }}
        >
          <AlertTriangle className="h-4 w-4" style={{ color: accent }} />
          <h3
            id="confirm-dialog-title"
            className="text-sm font-bold font-mono-cyber flex-1"
            style={{ color: accent }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 transition-all disabled:opacity-40"
            style={{ color: "#64748b" }}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {message && (
            <div className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
              {message}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: "rgba(100,116,139,0.08)",
              border: "1px solid rgba(100,116,139,0.2)",
              color: "#94a3b8",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}55`,
              color: accent,
            }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
