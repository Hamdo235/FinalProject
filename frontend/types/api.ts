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
  id: number;
  lat?: number;
  lon?: number;
  ip?: string;
  severity: string;
  ts: string;
}

export interface IncidentExplanation {
  incident_id: number;
  explanation: string;
  confidence: number;
  sources?: string[];
}

export interface SSEAlertEvent {
  type: 'alert_created';
  data: Alert;
}
