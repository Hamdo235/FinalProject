export function parseApiDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  const raw = String(input || '').trim();
  if (!raw) return new Date(NaN);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  return new Date(hasZone ? raw : `${raw}Z`);
}

export function formatDateTimeLocal(input: string | number | Date): string {
  const d = parseApiDate(input);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeLocal(input: string | number | Date): string {
  const d = parseApiDate(input);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateLocal(input: string | number | Date): string {
  const d = parseApiDate(input);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatRelativeLocal(input: string | number | Date): string {
  const d = parseApiDate(input);
  if (!Number.isFinite(d.getTime())) return '—';
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
