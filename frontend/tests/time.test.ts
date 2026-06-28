/**
 * Tests unitaires pour les helpers de date/heure (lib/time.ts).
 * Logique pure et déterministe (les `format*Local` dépendant de la locale ne
 * sont testés que sur leur comportement de repli `—`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDateLocal,
  formatDateTimeLocal,
  formatRelativeLocal,
  formatTimeLocal,
  parseApiDate,
} from '@/lib/time';

afterEach(() => {
  vi.useRealTimers();
});

describe('parseApiDate()', () => {
  it('retourne la même instance Date en entrée', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(parseApiDate(d)).toBe(d);
  });

  it('interprète un nombre comme un timestamp epoch (ms)', () => {
    expect(parseApiDate(0).getTime()).toBe(0);
    expect(parseApiDate(1_000).getTime()).toBe(1_000);
  });

  it('traite une date sans fuseau comme de l\'UTC (ajout d\'un Z)', () => {
    // 12:00 sans zone => 12:00Z
    const withZone = parseApiDate('2026-06-28T12:00:00Z').getTime();
    const without = parseApiDate('2026-06-28T12:00:00').getTime();
    expect(without).toBe(withZone);
  });

  it('respecte un décalage de fuseau explicite', () => {
    const utc = parseApiDate('2026-06-28T12:00:00Z').getTime();
    const plus2 = parseApiDate('2026-06-28T14:00:00+02:00').getTime();
    expect(plus2).toBe(utc);
  });

  it('retourne une date invalide (NaN) pour une chaîne vide', () => {
    expect(Number.isNaN(parseApiDate('').getTime())).toBe(true);
  });
});

describe('format*Local() — repli pour dates invalides', () => {
  it('retourne le tiret cadratin sur une entrée vide', () => {
    expect(formatDateTimeLocal('')).toBe('—');
    expect(formatTimeLocal('')).toBe('—');
    expect(formatDateLocal('')).toBe('—');
    expect(formatRelativeLocal('')).toBe('—');
  });

  it('produit une chaîne non vide pour une date valide', () => {
    const d = '2026-06-28T12:00:00Z';
    expect(formatDateTimeLocal(d)).not.toBe('—');
    expect(formatTimeLocal(d)).not.toBe('—');
    expect(formatDateLocal(d)).not.toBe('—');
  });
});

describe('formatRelativeLocal()', () => {
  function at(now: string, then: string): string {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    return formatRelativeLocal(then);
  }

  it('"à l\'instant" pour moins de 10 secondes', () => {
    expect(at('2026-06-28T12:00:05Z', '2026-06-28T12:00:00Z')).toBe("à l'instant");
  });

  it('secondes pour moins d\'une minute', () => {
    expect(at('2026-06-28T12:00:30Z', '2026-06-28T12:00:00Z')).toBe('il y a 30s');
  });

  it('minutes pour moins d\'une heure', () => {
    expect(at('2026-06-28T12:30:00Z', '2026-06-28T12:00:00Z')).toBe('il y a 30 min');
  });

  it('heures pour moins d\'un jour', () => {
    expect(at('2026-06-28T15:00:00Z', '2026-06-28T12:00:00Z')).toBe('il y a 3 h');
  });

  it('jours au-delà de 24 h', () => {
    expect(at('2026-07-01T12:00:00Z', '2026-06-28T12:00:00Z')).toBe('il y a 3 j');
  });

  it('borne les dates futures à "à l\'instant" (diff négatif clampé)', () => {
    expect(at('2026-06-28T12:00:00Z', '2026-06-28T12:01:00Z')).toBe("à l'instant");
  });
});
