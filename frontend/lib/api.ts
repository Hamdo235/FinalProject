import {
  Alert,
  Incident,
  AlertLabel,
  ModelMetrics,
  MapPoint,
  IncidentExplanation,
  SSEAlertEvent,
  DefenseAction,
  DefenseStatus,
} from '@/types/api';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

/**
 * Wrapper fetch avec gestion d’erreurs basique
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const isServer = typeof window === 'undefined';
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...(isServer ? { cache: 'no-store' as RequestCache } : {}),
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
 * Récupérer la liste des incidents
 */
export async function fetchIncidents(): Promise<Incident[]> {
  return apiFetch<Incident[]>('/incidents');
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
export async function demoGenerate(): Promise<{ created: number }> {
  return apiFetch<{ created: number }>('/demo/generate', { method: 'POST' });
}

export async function demoReset(): Promise<{ reset: boolean }> {
  return apiFetch<{ reset: boolean }>('/demo/reset', { method: 'POST' });
}

export async function fetchDefenseActions(params?: { limit?: number; active?: boolean; ip?: string }): Promise<DefenseAction[]> {
  const qp = new URLSearchParams();
  if (params?.limit !== undefined) qp.set('limit', String(params.limit));
  if (params?.active !== undefined) qp.set('active', String(params.active));
  if (params?.ip) qp.set('ip', params.ip);
  const suffix = qp.toString() ? `?${qp.toString()}` : '';
  return apiFetch<DefenseAction[]>(`/defense/actions${suffix}`);
}

export async function fetchDefenseStatus(ip: string): Promise<DefenseStatus> {
  return apiFetch<DefenseStatus>(`/defense/status/${encodeURIComponent(ip)}`);
}

export async function approveDefenseAction(actionId: number): Promise<{ ok: boolean; action: DefenseAction }> {
  return apiFetch<{ ok: boolean; action: DefenseAction }>(`/defense/actions/${actionId}/approve`, {
    method: 'POST',
  });
}

export async function revokeDefenseAction(actionId: number): Promise<{ ok: boolean; action: DefenseAction }> {
  return apiFetch<{ ok: boolean; action: DefenseAction }>(`/defense/actions/${actionId}/revoke`, {
    method: 'POST',
  });
}

/**
 * Ouvrir un flux SSE pour les alertes en temps réel
 */
export function createAlertsSSE(onAlert: (alert: Alert) => void): EventSource {
  const es = new EventSource(`${API_BASE}/stream/alerts`);
  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as SSEAlertEvent;
      if ((parsed.type === 'alert.created' || parsed.type === 'alert_created') && (parsed as any).data) {
        onAlert((parsed as any).data);
      } else if (parsed.type === 'alert.created' && parsed.id) {
        // Fallback if backend sends only id
        fetchAlerts()
          .then((alerts) => {
            if (alerts.length > 0) onAlert(alerts[0]);
          })
          .catch(() => {});
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
