/**
 * Types pour les réponses de l’API backend
 */

export interface Alert {
  id: number;
  ts: string; // ISO timestamp
  source: string;
  ip?: string;
  user?: string;
  rule?: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  status: string;
  features_json?: string;
  defense?: DefenseAction;
}

export interface DefenseAction {
  id: number;
  alert_id?: number | null;
  ip?: string | null;
  action: 'allow' | 'monitor' | 'review' | 'block_temp' | string;
  reason?: string | null;
  confidence: number;
  mode: 'off' | 'monitor' | 'assist' | 'auto' | string;
  expires_at?: string | null;
  active: boolean;
  created_at?: string;
  created_by?: 'system' | 'human' | string;
}

export interface DefenseStatus {
  ip: string;
  mode: string;
  blocked: boolean;
  block?: DefenseAction | null;
}

export interface Incident {
  id: number;
  created_at: string;
  status: string;
  summary?: string;
  risk?: string;
  confidence: number;
  related_alerts_json?: string;
}

export interface AlertLabel {
  id: number;
  alert_id: number;
  label: 'true_attack' | 'false_positive';
  noted_at: string;
}

export interface ModelMetrics {
  samples: number;
  threshold: number;
  roc_auc?: number;
  precision: number;
  recall: number;
  f1: number;
  positives: number;
  negatives: number;
}

export interface MapPoint {
  ip: string;
  country?: string | null;
  lat: number;
  lon: number;
  count: number;
}

export interface IncidentExplanation {
  incident_id: number;
  response: string;
  confidence: number;
  sources?: string[];
}

export interface SSEAlertEvent {
  type: 'alert.created' | 'hello' | 'error' | string;
  id?: number;
  severity?: string;
  time?: string;
  data?: Alert;
}
