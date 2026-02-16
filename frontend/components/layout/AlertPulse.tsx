"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAlertsSSE } from "@/lib/api";
import { AlertTriangle, MapPin, MessageCircle, ExternalLink } from "lucide-react";

export default function AlertPulse() {
  const pathname = usePathname();
  const [toast, setToast] = React.useState<{
    id: number;
    severity?: string;
    ip?: string;
    ts?: string;
  } | null>(null);

  React.useEffect(() => {
    const es = createAlertsSSE((newAlert) => {
      setToast({
        id: newAlert.id,
        severity: newAlert.severity,
        ip: newAlert.ip,
        ts: newAlert.ts,
      });
    });
    return () => es.close();
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || pathname?.startsWith("/chat")) return null;

  const sev = toast.severity || "low";
  const tone =
    sev === "high"
      ? "border-red-300 bg-red-50 text-red-800"
      : sev === "medium"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-emerald-300 bg-emerald-50 text-emerald-800";

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-[360px]">
      <div className={`rounded-xl border shadow-lg p-4 ${tone}`}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/80 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide opacity-70">Nouvelle alerte</div>
            <div className="font-semibold">
              Alerte #{toast.id} • {sev}
            </div>
            <div className="text-xs opacity-80">{toast.ip ? `IP: ${toast.ip}` : "IP inconnue"}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/alerts" className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
            <ExternalLink className="h-3 w-3" />
            Alertes
          </Link>
          <Link
            href={toast.ip ? `/dashboard?ip=${encodeURIComponent(toast.ip)}#map` : "/dashboard#map"}
            className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1"
          >
            <MapPin className="h-3 w-3" />
            Carte
          </Link>
          <Link href="/chat" className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
            <MessageCircle className="h-3 w-3" />
            Chatbot
          </Link>
        </div>
      </div>
    </div>
  );
}
