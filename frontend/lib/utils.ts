import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne les classes TailwindCSS de manière fiable
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formate un timestamp ISO en date lisible (français)
 */
export function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

/**
 * Retourne une couleur Tailwind selon la sévérité
 */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return 'text-danger bg-danger/10';
    case 'medium':
      return 'text-warning bg-warning/10';
    case 'low':
      return 'text-success bg-success/10';
    default:
      return 'text-gray-500 bg-gray-100';
  }
}

/**
 * Retourne une icône Lucide selon la sévérité
 */
export function severityIcon(severity: string): string {
  switch (severity) {
    case 'high':
      return 'AlertTriangle';
    case 'medium':
      return 'AlertCircle';
    case 'low':
      return 'Info';
    default:
      return 'HelpCircle';
  }
}
