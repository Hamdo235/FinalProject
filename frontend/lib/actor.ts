import { getUsername, getUserProfile } from '@/components/layout/AuthProvider';

export type ActorProfile = {
  username: string;
  role: string;
};

export function getActorProfile(): ActorProfile | null {
  if (typeof window === 'undefined') return null;
  const username = getUsername();
  if (!username) return null;
  const profile = getUserProfile();
  return {
    username,
    role: (profile?.role || 'Analyste SOC').trim() || 'Analyste SOC',
  };
}

export function getActorLabel(): string {
  const p = getActorProfile();
  if (!p) return 'Analyste SOC';
  return `${p.username} (${p.role})`;
}
