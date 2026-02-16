"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import IncidentCard from "@/components/IncidentCard";
import { fetchIncidents } from "@/lib/api";
import { Incident } from "@/types/api";

export default function IncidentsPage() {
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch (e) {
      setError("Impossible de charger les incidents.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Incidents</h1>
        <p className="text-sm text-gray-600 mt-1">
          Liste des incidents créés à partir des alertes. Cliquez pour voir les détails et les explications LLM.
        </p>
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-2">
        <Link href="/alerts">
          <Button variant="outline">Créer un incident depuis les alertes</Button>
        </Link>
        <Link href="/dashboard#map">
          <Button variant="outline">Voir la carte</Button>
        </Link>
        <Link href="/chat">
          <Button variant="outline">Consulter le chatbot</Button>
        </Link>
        <Button variant="outline" onClick={load}>Rafraîchir</Button>
      </div>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Incidents ({incidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <EmptyState
              title="Aucun incident"
              description="Aucun incident n’a encore été créé. Allez dans la page Alertes pour en créer un."
            >
              <Link href="/alerts">
                <Button>Voir les alertes</Button>
              </Link>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="text-danger text-sm">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
