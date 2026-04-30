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
  BlockedIp,
  HealthStatus,
} from '@/types/api';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function withAdminHeader(headers?: HeadersInit): HeadersInit {
  const merged: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (ADMIN_TOKEN) merged['X-ADMIN-TOKEN'] = ADMIN_TOKEN;
  return merged;
}

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
      headers: withAdminHeader(fetchOptions.headers),
      ...(isServer ? { cache: 'no-store' as RequestCache } : {}),
      ...fetchOptions,
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text();
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.detail === 'string') detail = parsed.detail;
      } catch {
        // keep raw text as detail
      }
      if (res.status === 401) {
        throw new Error("Accès refusé (401). Configurez NEXT_PUBLIC_ADMIN_TOKEN ou ajoutez le header X-ADMIN-TOKEN.");
      }
      throw new Error(detail ? `API ${res.status}: ${detail}` : `API ${res.status}`);
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

export async function approveDefenseAction(
  actionId: number,
  approvedBy = 'Analyste SOC',
): Promise<{ ok: boolean; action: DefenseAction; message?: string; iptables_command?: string; iptables_unblock?: string }> {
  return apiFetch(`/defense/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved_by: approvedBy }),
  });
}

export async function revokeDefenseAction(actionId: number): Promise<{ ok: boolean; action: DefenseAction; message?: string }> {
  return apiFetch(`/defense/actions/${actionId}/revoke`, { method: 'POST' });
}

export async function fetchBlockedIps(): Promise<BlockedIp[]> {
  return apiFetch<BlockedIp[]>('/defense/blocked');
}

export async function manualBlockIp(body: {
  ip: string;
  reason?: string;
  ttl_minutes?: number;
  approved_by?: string;
}): Promise<{ ok: boolean; action: DefenseAction; message?: string; iptables_command?: string; iptables_unblock?: string }> {
  return apiFetch('/defense/block-manual', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function unblockIpDirect(ip: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch(`/defense/unblock/${encodeURIComponent(ip)}`, { method: 'POST' });
}

export async function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}

/**
 * Ouvrir un flux SSE générique sur /stream/alerts.
 *
 * Le serveur publie `alert.created` ET `defense.changed` sur le même canal.
 * Le navigateur reconnecte automatiquement via EventSource (~3s) tant que la
 * connexion n'est pas fermée explicitement.
 */
export interface SSEHandlers {
  onAlert?: (alert: Alert) => void;
  onDefense?: (event: import('@/types/api').SSEDefenseEvent) => void;
  onError?: () => void;
  onOpen?: () => void;
}

export function createEventStream(handlers: SSEHandlers): EventSource {
  const es = new EventSource(`${API_BASE}/stream/alerts`);

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as SSEAlertEvent | import('@/types/api').SSEDefenseEvent;
      if (parsed.type === 'defense.changed') {
        handlers.onDefense?.(parsed as import('@/types/api').SSEDefenseEvent);
        return;
      }
      const alertEvt = parsed as SSEAlertEvent;
      if (
        (alertEvt.type === 'alert.created' || alertEvt.type === 'alert_created') &&
        alertEvt.data
      ) {
        handlers.onAlert?.(alertEvt.data);
      } else if (alertEvt.type === 'alert.created' && alertEvt.id) {
        fetchAlerts()
          .then((alerts) => {
            if (alerts.length > 0) handlers.onAlert?.(alerts[0]);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn('[SSE] Erreur parsing event:', err);
    }
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      console.warn('[SSE] Connexion fermée définitivement par le serveur.');
    }
    handlers.onError?.();
  };
  es.onopen = () => handlers.onOpen?.();
  return es;
}

/**
 * @deprecated use createEventStream({ onAlert }) instead.
 * Maintenu pour compat de code existant.
 */
export function createAlertsSSE(onAlert: (alert: Alert) => void): EventSource {
  return createEventStream({ onAlert });
}
