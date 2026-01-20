"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Shield, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Incident } from "@/types/api";

interface IncidentCardProps {
  incident: Incident;
}

/**
 * Carte incident pour liste ou dashboard
 */
export default function IncidentCard({ incident }: IncidentCardProps) {
  const statusVariant = incident.status === "open" ? "warning" : "success";
  const statusIcon = incident.status === "open" ? Clock : CheckCircle;

  const relatedAlerts = incident.related_alerts_json ? JSON.parse(incident.related_alerts_json) : [];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary-500" />
            <Link href={`/incidents/${incident.id}`} className="hover:underline">
              Incident #{incident.id}
            </Link>
          </div>
          <Badge variant={statusVariant} className="flex items-center gap-1">
            {React.createElement(statusIcon, { className: "h-3 w-3" })}
            {incident.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">
          <span className="font-medium">Créé le :</span>{" "}
          {new Date(incident.created_at).toLocaleString()}
        </div>
        <div className="text-sm">
          <span className="font-medium">Confiance :</span> {(incident.confidence * 100).toFixed(1)}%
        </div>
        {incident.risk && (
          <div className="text-sm">
            <span className="font-medium">Risque :</span>{" "}
            <Badge variant="outline" className="ml-2">
              {incident.risk}
            </Badge>
          </div>
        )}
        {incident.summary && (
          <div className="text-sm text-gray-700 line-clamp-2">{incident.summary}</div>
        )}
        <div className="text-xs text-gray-500">
          {relatedAlerts.length} alerte{relatedAlerts.length > 1 ? "s" : ""} liée{relatedAlerts.length > 1 ? "s" : ""}
        </div>
        <div className="pt-2">
          <Link href={`/incidents/${incident.id}`}>
            <Button size="sm" variant="outline" className="w-full">
              Voir les détails
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
