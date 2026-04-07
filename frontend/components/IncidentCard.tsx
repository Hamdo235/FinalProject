"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Incident } from "@/types/api";

export default function IncidentCard({ incident }: { incident: Incident }) {
  const isOpen = incident.status === "open";
  const relatedAlerts: number[] = incident.related_alerts_json
    ? JSON.parse(incident.related_alerts_json)
    : [];

  const confidence = (incident.confidence * 100).toFixed(1);
  const confColor =
    incident.confidence >= 0.75
      ? "#ef4444"
      : incident.confidence >= 0.5
      ? "#f59e0b"
      : "#10b981";

  return (
    <Card
      className="transition-all hover:border-cyan-400/20 group"
      style={{
        borderColor: isOpen ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.15)",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert
              className="h-4 w-4 shrink-0"
              style={{ color: isOpen ? "#f59e0b" : "#10b981" }}
            />
            <Link
              href={`/incidents/${incident.id}`}
              className="hover:underline font-semibold"
              style={{ color: "#e2e8f0" }}
            >
              Incident #{incident.id}
            </Link>
          </div>
          <Badge variant={isOpen ? "warning" : "success"} className="flex items-center gap-1 shrink-0">
            {isOpen ? <Clock className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
            {incident.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Confidence bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "#64748b" }}>Confiance</span>
            <span className="text-xs font-bold font-mono-cyber" style={{ color: confColor }}>
              {confidence}%
            </span>
          </div>
          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidence}%`,
                background: confColor,
                boxShadow: `0 0 6px ${confColor}60`,
              }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div style={{ color: "#334155" }}>Créé le</div>
            <div className="font-mono-cyber mt-0.5" style={{ color: "#94a3b8" }}>
              {new Date(incident.created_at).toLocaleDateString()}
            </div>
          </div>
          {incident.risk && (
            <div>
              <div style={{ color: "#334155" }}>Risque</div>
              <Badge variant="outline" className="mt-0.5">{incident.risk}</Badge>
            </div>
          )}
        </div>

        {incident.summary && (
          <p
            className="text-xs line-clamp-2 leading-relaxed"
            style={{ color: "#64748b" }}
          >
            {incident.summary}
          </p>
        )}

        <div
          className="text-[11px] font-mono-cyber"
          style={{ color: "#334155" }}
        >
          {relatedAlerts.length} alerte{relatedAlerts.length !== 1 ? "s" : ""} liée{relatedAlerts.length !== 1 ? "s" : ""}
        </div>

        <Link href={`/incidents/${incident.id}`}>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-1 group-hover:border-cyan-400/30 transition-all flex items-center gap-2"
          >
            Voir les détails
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
