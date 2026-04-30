export type ActorProfile = {
  username: string;
  role: string;
};

const USER_KEY = 'cs_username';
const USERS_KEY = 'cs_users';

export function getActorProfile(): ActorProfile | null {
  if (typeof window === 'undefined') return null;
  const username = (localStorage.getItem(USER_KEY) || '').trim();
  if (!username) return null;
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return { username, role: 'Analyste SOC' };
    const users = JSON.parse(raw) as Array<{ username?: string; role?: string }>;
    const found = users.find((u) => (u.username || '').toLowerCase() === username.toLowerCase());
    return {
      username,
      role: (found?.role || 'Analyste SOC').trim() || 'Analyste SOC',
    };
  } catch {
    return { username, role: 'Analyste SOC' };
  }
}

export function getActorLabel(): string {
  const p = getActorProfile();
  if (!p) return 'Analyste SOC';
  return `${p.username} (${p.role})`;
}
