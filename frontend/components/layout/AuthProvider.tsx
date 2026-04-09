"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatbotDock from "./ChatbotDock";
import AlertPulse from "./AlertPulse";
import MainContent from "./MainContent";
import BlockingNotification from "@/components/BlockingNotification";
import { createAlertsSSE } from "@/lib/api";
import { Alert } from "@/types/api";

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
};

function getUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as StoredUser[];
  } catch {}
  // seed default admin account
  const defaults: StoredUser[] = [{ username: "admin", password: "sentinel2024" }];
  localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
  return defaults;
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

export function login(username: string, password: string): boolean {
  const users = getUsers();
  const found = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );
  if (!found) return false;
  localStorage.setItem(AUTH_KEY,  "cs_session_" + Date.now());
  localStorage.setItem(USER_KEY,  found.username);
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

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const isLogin   = pathname === "/login";
  const [checked, setChecked] = React.useState(false);
  const [latestAlert, setLatestAlert] = React.useState<Alert | null>(null);

  React.useEffect(() => {
    if (!isLogin && !isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [isLogin, router]);

  React.useEffect(() => {
    if (isLogin || !checked) return;
    const es = createAlertsSSE((alert) => {
      if (alert.severity === "high") setLatestAlert(alert);
    });
    return () => es.close();
  }, [isLogin, checked]);

  // Login page: full-screen, no shell
  if (isLogin) {
    return <>{children}</>;
  }

  // Other pages: wait for auth check before rendering shell
  if (!checked) return null;

  return (
    <div className="flex h-screen min-h-0">
      <Sidebar />
      <MainContent>{children}</MainContent>
      <ChatbotDock />
      <AlertPulse />
      <BlockingNotification newAlert={latestAlert} />
    </div>
  );
}
