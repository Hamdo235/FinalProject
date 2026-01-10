import { Alert, Incident, AlertLabel, ModelMetrics, MapPoint, IncidentExplanation, SSEAlertEvent } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

/**
 * Wrapper fetch avec gestion d’erreurs basique
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Récupérer la liste des alertes
 */
export async function fetchAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>('/alerts');
}

/**
 * Récupérer un incident par id
 */
export async function fetchIncident(id: number): Promise<Incident> {
  return apiFetch<Incident>(`/incidents/${id}`);
}

/**
 * Créer un incident à partir d’alertes
 */
export async function createIncidentFromAlerts(alertIds: number[]): Promise<Incident> {
  return apiFetch<Incident>('/incidents/from-alerts', {
    method: 'POST',
    body: JSON.stringify(alertIds),
  });
}

/**
 * Demander une explication LLM pour un incident
 */
export async function explainIncident(id: number): Promise<IncidentExplanation> {
  return apiFetch<IncidentExplanation>(`/llm/incidents/${id}/explain`, {
    method: 'POST',
  });
}

/**
 * Labelliser une alerte (true_attack / false_positive)
 */
export async function labelAlert(alertId: number, label: 'true_attack' | 'false_positive'): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/validation/alerts/${alertId}?label=${label}`, {
    method: 'POST',
  });
}

/**
 * Récupérer les métriques du modèle
 */
export async function fetchModelMetrics(): Promise<ModelMetrics> {
  return apiFetch<ModelMetrics>('/metrics/model');
}

/**
 * Récupérer les points pour la carte GeoIP
 */
export async function fetchMapPoints(): Promise<MapPoint[]> {
  return apiFetch<MapPoint[]>('/map/points');
}

/**
 * Démarrer/arrêter la génération de logs de démo
 */
export async function demoGenerate(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/demo/generate', { method: 'POST' });
}

export async function demoReset(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/demo/reset', { method: 'POST' });
}

/**
 * Ouvrir un flux SSE pour les alertes en temps réel
 */
export function createAlertsSSE(onAlert: (alert: Alert) => void): EventSource {
  const es = new EventSource(`${API_BASE}/stream/alerts`);
  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as SSEAlertEvent;
      if (parsed.type === 'alert_created') {
        onAlert(parsed.data);
      }
    } catch (err) {
      console.error('Erreur parsing SSE alert', err);
    }
  };
  es.onerror = (err) => {
    console.error('SSE error', err);
  };
  return es;
}
