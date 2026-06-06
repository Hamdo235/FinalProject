"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Incident } from "@/types/api";
import { formatDateLocal } from "@/lib/time";

export default function IncidentCard({ incident }: { incident: Incident }) {
  const isOpen = incident.status === "open";
  const relatedAlerts: number[] = incident.related_alerts_json
    ? JSON.parse(incident.related_alerts_json)
    : [];

  const confidence = (incident.confidence * 100).toFixed(1);
  const confCls =
    incident.confidence >= 0.75 ? "text-accent-red bg-accent-red"
    : incident.confidence >= 0.5 ? "text-accent-amber bg-accent-amber"
    : "text-accent-teal-bright bg-accent-teal";

  const [confTextCls, confBarCls] = confCls.split(" ");

  return (
    <Card
      className="transition-all group"
      accentColor={isOpen ? "amber" : "teal"}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 shrink-0 ${isOpen ? "text-accent-amber" : "text-accent-teal-bright"}`} />
            <Link
              href={`/incidents/${incident.id}`}
              className="hover:underline font-semibold text-text-primary"
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
            <span className="text-xs text-text-secondary">Confiance</span>
            <span className={`text-xs font-bold font-mono-cyber ${confTextCls}`}>{confidence}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.05]">
            <div
              className={`h-full rounded-full transition-all ${confBarCls}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-text-muted">Créé le</div>
            <div className="font-mono-cyber mt-0.5 text-text-secondary">
              {formatDateLocal(incident.created_at)}
            </div>
          </div>
          {incident.risk && (
            <div>
              <div className="text-text-muted">Risque</div>
              <Badge variant="outline" className="mt-0.5">{incident.risk}</Badge>
            </div>
          )}
        </div>

        {incident.summary && (
          <p className="text-xs line-clamp-2 leading-relaxed text-text-secondary">
            {incident.summary}
          </p>
        )}

        <div className="text-[11px] font-mono-cyber text-text-muted">
          {relatedAlerts.length} alerte{relatedAlerts.length !== 1 ? "s" : ""} liée{relatedAlerts.length !== 1 ? "s" : ""}
        </div>

        <Link href={`/incidents/${incident.id}`}>
          <Button size="sm" variant="outline" className="w-full mt-1 flex items-center gap-2">
            Voir les détails
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
