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
 * Wrapper fetch avec gestion d'erreurs et timeout via AbortController.
 * @param timeoutMs  30 000 ms par défaut — passer 120 000 pour les appels LLM.
 */
async function apiFetch<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isServer = typeof window === 'undefined';
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
      ...(isServer ? { cache: 'no-store' as RequestCache } : {}),
      ...fetchOptions,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Delai depasse (${timeoutMs / 1000}s) - le serveur n'a pas repondu.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
 * Créer un incident à partir d'alertes
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
  // LLM local (Ollama) peut prendre 30–180 s selon le matériel.
  return apiFetch<IncidentExplanation>(`/llm/incidents/${id}/explain`, {
    method: 'POST',
    timeoutMs: 180_000,
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
  let errorCount = 0;
  const MAX_ERRORS = 5;

  es.onmessage = (e) => {
    errorCount = 0;
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
      console.warn('[SSE] Erreur parsing alerte:', err);
    }
  };
  es.onerror = () => {
    errorCount += 1;
    if (errorCount >= MAX_ERRORS) {
      console.warn(`[SSE] Backend inaccessible après ${MAX_ERRORS} tentatives — flux fermé.`);
      es.close();
    }
  };
  return es;
}
