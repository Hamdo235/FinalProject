"use client";
import React from "react";
import { TOTP, Secret } from 'otpauth';
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatbotDock from "./ChatbotDock";
import AlertPulse from "./AlertPulse";
import MainContent from "./MainContent";
import BlockingNotification from "@/components/BlockingNotification";
import RealtimeProvider from "./RealtimeProvider";
import ToastStack from "@/components/ToastStack";
import ErrorBoundary from "@/components/ErrorBoundary";

const AUTH_KEY  = "cs_auth";
const USER_KEY  = "cs_username";
const USERS_KEY = "cs_users";

export type StoredUser = {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
  mfaSecret?: string;
  mfaEnabled?: boolean;
};

function getUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as StoredUser[];
  } catch {}
  return [];
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(AUTH_KEY);
}

export function getUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USER_KEY) ?? "utilisateur";
}

export function getUserProfile(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const username = localStorage.getItem(USER_KEY);
  if (!username) return null;
  const users = getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export function checkPassword(username: string, password: string): StoredUser | null {
  const users = getUsers();
  return users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  ) ?? null;
}

export function createSession(username: string): void {
  localStorage.setItem(AUTH_KEY, "cs_session_" + Date.now());
  localStorage.setItem(USER_KEY, username);
}

export function login(username: string, password: string): boolean {
  const found = checkPassword(username, password);
  if (!found) return false;
  createSession(found.username);
  return true;
}

export function generateMfaSecret(): string {
  return new Secret().base32;
}

export function getMfaQrUri(username: string, secret: string): string {
  return new TOTP({ issuer: 'CyberSentinel-LLM', label: username,
    algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).toString();
}

export function verifyMfaToken(secret: string, token: string): boolean {
  try {
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    return totp.validate({ token: token.replace(/\s/g, ''), window: 1 }) !== null;
  } catch { return false; }
}

export function enableMfa(username: string, secret: string): boolean {
  if (typeof window === 'undefined') return false;
  const users = getUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return false;
  users[idx] = { ...users[idx], mfaSecret: secret, mfaEnabled: true };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
}

export function disableMfa(username: string): boolean {
  if (typeof window === 'undefined') return false;
  const users = getUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return false;
  users[idx] = { ...users[idx], mfaSecret: undefined, mfaEnabled: false };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
}

export function register(
  username: string,
  password: string,
  opts?: { email?: string; phone?: string; role?: string },
): { ok: boolean; error?: string } {
  if (!username.trim() || username.length < 3)
    return { ok: false, error: "L'identifiant doit faire au moins 3 caractères." };
  if (password.length < 6)
    return { ok: false, error: "Le mot de passe doit faire au moins 6 caractères." };
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: "Cet identifiant est déjà utilisé." };
  const newUser: StoredUser = {
    username: username.trim(),
    password,
    email: opts?.email?.trim() || undefined,
    phone: opts?.phone?.trim() || undefined,
    role: opts?.role || "Analyste SOC",
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(AUTH_KEY,  "cs_session_" + Date.now());
  localStorage.setItem(USER_KEY,  username.trim());
  return { ok: true };
}

export function addUser(
  username: string,
  password: string,
  opts?: { email?: string; phone?: string; role?: string },
): { ok: boolean; error?: string } {
  if (!username.trim() || username.length < 3)
    return { ok: false, error: "L'identifiant doit faire au moins 3 caractères." };
  if (password.length < 6)
    return { ok: false, error: "Le mot de passe doit faire au moins 6 caractères." };
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: "Cet identifiant est déjà utilisé." };
  const newUser: StoredUser = {
    username: username.trim(),
    password,
    email: opts?.email?.trim() || undefined,
    phone: opts?.phone?.trim() || undefined,
    role: opts?.role || "Analyste SOC",
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return { ok: true };
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const isLogin   = pathname === "/login";
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (!isLogin && !isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [isLogin, router]);

  // Login page: full-screen, no shell
  if (isLogin) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  // Other pages: show a dark loading screen while auth fires client-side
  if (!checked) return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#0D1117",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #262D38",
            borderTopColor: "#6FB894",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <span style={{ color: "#6B7280", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
          Chargement…
        </span>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <RealtimeProvider>
        <div className="flex h-screen min-h-0">
          <Sidebar />
          <MainContent>{children}</MainContent>
          <ChatbotDock />
          <AlertPulse />
          <BlockingNotification />
          <ToastStack />
        </div>
      </RealtimeProvider>
    </ErrorBoundary>
  );
}
