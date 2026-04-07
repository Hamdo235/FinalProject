"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import IncidentCard from "@/components/IncidentCard";
import { fetchIncidents } from "@/lib/api";
import { Incident } from "@/types/api";
import { ShieldAlert, RefreshCw, BellRing, MapPin, MessageCircle } from "lucide-react";

export default function IncidentsPage() {
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [error, setError]         = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null); setLoading(true);
    try { setIncidents(await fetchIncidents()); }
    catch { setError("Impossible de charger les incidents."); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openCount   = incidents.filter((i) => i.status === "open").length;
  const closedCount = incidents.filter((i) => i.status !== "open").length;

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Incidents</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {incidents.length} incident{incidents.length !== 1 ? "s" : ""} —{" "}
            <span style={{ color: "#f59e0b" }}>{openCount} ouvert{openCount !== 1 ? "s" : ""}</span>
            {closedCount > 0 && (
              <span style={{ color: "#10b981" }}>{", "}{closedCount} fermé{closedCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} className="flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </Button>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2">
        <Link href="/alerts">
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5" />
            Créer depuis les alertes
          </Button>
        </Link>
        <Link href="/dashboard#map">
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Carte GeoIP
          </Button>
        </Link>
        <Link href="/chat">
          <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Chat SOC
          </Button>
        </Link>
      </div>

      {/* ── Stats strip ── */}
      {incidents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",  value: incidents.length,                 color: "#22d3ee" },
            { label: "Ouverts", value: openCount,                        color: "#f59e0b" },
            { label: "Fermés", value: closedCount,                       color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="cyber-card p-4 text-center"
              style={{ borderColor: `${color}25` }}
            >
              <div className="text-2xl font-bold font-mono-cyber" style={{ color }}>
                {value}
              </div>
              <div className="text-xs mt-1 uppercase tracking-wider" style={{ color: "#334155" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" style={{ color: "#f59e0b" }} />
            Liste des incidents
            <span
              className="cyber-badge font-mono-cyber"
              style={{
                background: "rgba(34,211,238,0.08)",
                color: "#22d3ee",
                border: "1px solid rgba(34,211,238,0.2)",
              }}
            >
              {incidents.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <EmptyState
              title="Aucun incident"
              description="Allez dans la page Alertes pour sélectionner des alertes et créer un incident."
            >
              <Link href="/alerts">
                <Button>Voir les alertes</Button>
              </Link>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="text-sm" style={{ color: "#ef4444" }}>
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
