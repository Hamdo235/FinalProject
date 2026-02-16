"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Activity, AlertTriangle, Shield, Play, BarChart3, Globe, MessageCircle } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl md:text-5xl font-bold font-display text-gray-900">CyberSentinel‑LLM</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Plateforme d’analyse de sécurité avec détection par apprentissage automatique et assistance
          explicative par LLM. Le système ne prend aucune décision automatique ; il aide l’analyste à
          comprendre et à labelliser les alertes.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg">
              <Activity className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/alerts">
            <Button size="lg" variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alertes
            </Button>
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-500" />
              Temps réel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success" className="animate-pulse-badge">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 bg-green-500 rounded-full" />
                LIVE
              </span>
            </Badge>
            <p className="text-xs text-gray-500 mt-2">Flux SSE actif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-warning" />
              Modèle ML
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">Isolation Forest</div>
            <p className="text-xs text-gray-500 mt-2">Seuil configurable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-info" />
              Assistant LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="info">Explicatif uniquement</Badge>
            <p className="text-xs text-gray-500 mt-2">Aucune action automatique</p>
          </CardContent>
        </Card>
      </section>

      {/* Navigation rapide */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary-500" />
                Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Vue d’ensemble, KPI, timeline, carte.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/alerts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alertes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Liste, filtres, labellisation.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/incidents">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-danger" />
                Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Détails, explication LLM, actions.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/demo">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-4 w-4 text-success" />
                Démo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Simulation, carte, graphiques.</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Cycle d’apprentissage */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-display">Cycle d’apprentissage adaptatif (contrôlé)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Détection</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Les logs sont analysés par le modèle ML → alertes.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Décision humaine</CardTitle>
            </CardHeader>
            <CardContent>
              <p>L’analyste labellise les alertes (true_attack / false_positive).</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Apprentissage</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Le modèle est réentraîné hors ligne avec les labels.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
