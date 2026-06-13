/**
 * Tests unitaires pour les fonctions d'authentification et 2FA.
 * Les imports de composants React sont mockés car on ne teste que la logique pure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks des composants React (hoistés avant les imports) ─────────────────
vi.mock('@/components/layout/Sidebar', () => ({ default: () => null }));
vi.mock('@/components/layout/ChatbotDock', () => ({ default: () => null }));
vi.mock('@/components/layout/AlertPulse', () => ({ default: () => null }));
vi.mock('@/components/layout/MainContent', () => ({ default: () => null }));
vi.mock('@/components/layout/RealtimeProvider', () => ({
  default: () => null,
  useRealtime: () => ({}),
}));
vi.mock('@/components/BlockingNotification', () => ({ default: () => null }));
vi.mock('@/components/ToastStack', () => ({ default: () => null }));
vi.mock('@/components/ErrorBoundary', () => ({ default: (p: { children: unknown }) => p.children }));

import {
  checkPassword,
  createSession,
  disableMfa,
  enableMfa,
  generateMfaSecret,
  getMfaQrUri,
  getUserProfile,
  getUsername,
  isAuthenticated,
  register,
  verifyMfaToken,
} from '@/components/layout/AuthProvider';

// ── Constantes localStorage ───────────────────────────────────────────────────
const USERS_KEY = 'cs_users';
const AUTH_KEY = 'cs_auth';
const USER_KEY = 'cs_username';

// ── Setup : réinitialiser le localStorage avant chaque test ───────────────────
beforeEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// register() + checkPassword()
// ─────────────────────────────────────────────────────────────────────────────
describe('register()', () => {
  it('crée un compte valide', () => {
    const res = register('Alice', 'password123');
    expect(res.ok).toBe(true);
    const users = JSON.parse(localStorage.getItem(USERS_KEY)!);
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('Alice');
  });

  it('refuse un identifiant trop court (<3 caractères)', () => {
    const res = register('ab', 'password123');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/3/);
  });

  it('refuse un mot de passe trop court (<6 caractères)', () => {
    const res = register('Alice', '123');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/6/);
  });

  it('refuse un doublon de nom d\'utilisateur (case-insensitive)', () => {
    register('Alice', 'password123');
    const res = register('alice', 'autremdp99');
    expect(res.ok).toBe(false);
  });
});

describe('checkPassword()', () => {
  beforeEach(() => {
    register('Bob', 'secret99', { role: 'Admin' });
    // register auto-crée la session — on la nettoie pour tester checkPassword seul
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  });

  it('retourne l\'utilisateur si identifiants corrects', () => {
    const user = checkPassword('Bob', 'secret99');
    expect(user).not.toBeNull();
    expect(user?.username).toBe('Bob');
    expect(user?.role).toBe('Admin');
  });

  it('retourne null si mot de passe incorrect', () => {
    expect(checkPassword('Bob', 'mauvais')).toBeNull();
  });

  it('retourne null si utilisateur inexistant', () => {
    expect(checkPassword('Inexistant', 'secret99')).toBeNull();
  });

  it('est insensible à la casse du nom d\'utilisateur', () => {
    const user = checkPassword('BOB', 'secret99');
    expect(user).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSession() + isAuthenticated() + getUsername()
// ─────────────────────────────────────────────────────────────────────────────
describe('createSession()', () => {
  it('marque la session comme authentifiée', () => {
    createSession('Carol');
    expect(isAuthenticated()).toBe(true);
    expect(getUsername()).toBe('Carol');
  });

  it('isAuthenticated() retourne false sans session', () => {
    expect(isAuthenticated()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateMfaSecret() + getMfaQrUri() + verifyMfaToken()
// ─────────────────────────────────────────────────────────────────────────────
describe('generateMfaSecret()', () => {
  it('retourne une chaîne base32 non vide', () => {
    const secret = generateMfaSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    // base32 : majuscules + chiffres 2-7
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('génère des secrets différents à chaque appel', () => {
    const s1 = generateMfaSecret();
    const s2 = generateMfaSecret();
    expect(s1).not.toBe(s2);
  });
});

describe('getMfaQrUri()', () => {
  it('retourne une URI otpauth://', () => {
    const secret = generateMfaSecret();
    const uri = getMfaQrUri('Alice', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('CyberSentinel-LLM');
    expect(uri).toContain('Alice');
  });
});

describe('verifyMfaToken()', () => {
  it('rejette un token invalide', () => {
    const secret = generateMfaSecret();
    expect(verifyMfaToken(secret, '000000')).toBe(false);
  });

  it('rejette un secret malformé sans lever d\'exception', () => {
    expect(() => verifyMfaToken('PAS_UN_SECRET_BASE32!!!', '123456')).not.toThrow();
    expect(verifyMfaToken('PAS_UN_SECRET_BASE32!!!', '123456')).toBe(false);
  });

  it('accepte le bon token TOTP pour le secret donné', () => {
    // Génère un secret + le token actuel via otpauth
    const { TOTP, Secret } = require('otpauth');
    const secret = generateMfaSecret();
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const token: string = totp.generate();
    expect(verifyMfaToken(secret, token)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enableMfa() + disableMfa() + getUserProfile()
// ─────────────────────────────────────────────────────────────────────────────
describe('enableMfa() / disableMfa()', () => {
  beforeEach(() => {
    register('Dave', 'mdp12345');
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  });

  it('enableMfa stocke le secret et passe mfaEnabled=true', () => {
    const secret = generateMfaSecret();
    const ok = enableMfa('Dave', secret);
    expect(ok).toBe(true);

    const users = JSON.parse(localStorage.getItem(USERS_KEY)!);
    const dave = users.find((u: { username: string }) => u.username === 'Dave');
    expect(dave.mfaEnabled).toBe(true);
    expect(dave.mfaSecret).toBe(secret);
  });

  it('disableMfa retire le secret et passe mfaEnabled=false', () => {
    const secret = generateMfaSecret();
    enableMfa('Dave', secret);
    const ok = disableMfa('Dave');
    expect(ok).toBe(true);

    const users = JSON.parse(localStorage.getItem(USERS_KEY)!);
    const dave = users.find((u: { username: string }) => u.username === 'Dave');
    expect(dave.mfaEnabled).toBe(false);
    expect(dave.mfaSecret).toBeUndefined();
  });

  it('enableMfa sur un utilisateur inexistant retourne false', () => {
    expect(enableMfa('Fantome', generateMfaSecret())).toBe(false);
  });

  it('getUserProfile retourne le profil de l\'utilisateur connecté', () => {
    createSession('Dave');
    const profile = getUserProfile();
    expect(profile).not.toBeNull();
    expect(profile?.username).toBe('Dave');
  });
});
