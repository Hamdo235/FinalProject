/**
 * Tests unitaires pour cn() (lib/utils.ts) — fusion de classes Tailwind.
 */
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('concatène plusieurs classes', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('ignore les valeurs falsy', () => {
    expect(cn('px-2', false, null, undefined, '', 'py-1')).toBe('px-2 py-1');
  });

  it('gère les classes conditionnelles via objet', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });

  it('dédoublonne les classes Tailwind conflictuelles (twMerge)', () => {
    // La dernière classe d'une même propriété l'emporte.
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('retourne une chaîne vide sans argument', () => {
    expect(cn()).toBe('');
  });
});
