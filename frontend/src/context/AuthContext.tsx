import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import { disconnectLive } from '../api/live';
import type { User, Role } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (householdName: string, displayName: string, email: string, password: string) => Promise<void>;
  join: (inviteCode: string, displayName: string, email: string, password: string) => Promise<void>;
  startDemo: () => Promise<void>;
  switchProfile: (memberId: string, pin?: string) => Promise<void>;
  adoptToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAtLeast: (role: Role) => boolean;
  /** Parents & owners can manage members, approve rewards, edit household settings. */
  isParent: boolean;
}

const ROLE_LEVELS: Record<string, number> = { owner: 4, parent: 3, member: 2, child: 1 };
const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('hh_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const persist = (u: User | null) => {
    setUser(u);
    if (u) localStorage.setItem('hh_user', JSON.stringify(u));
    else localStorage.removeItem('hh_user');
  };

  useEffect(() => {
    const token = localStorage.getItem('hh_token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(persist)
      .catch(() => { localStorage.removeItem('hh_token'); persist(null); })
      .finally(() => setLoading(false));
  }, []);

  const finishAuth = async (data: { token: string; user: User }) => {
    localStorage.setItem('hh_token', data.token);
    persist(data.user);
    const full = await api.me().catch(() => data.user);
    persist(full);
  };

  const login = async (email: string, password: string) => finishAuth(await api.login(email, password));
  const signup = async (householdName: string, displayName: string, email: string, password: string) =>
    finishAuth(await api.signup({ householdName, displayName, email, password }));
  const join = async (inviteCode: string, displayName: string, email: string, password: string) =>
    finishAuth(await api.joinHousehold({ inviteCode, displayName, email, password }));
  const switchProfile = async (memberId: string, pin?: string) => finishAuth(await api.switchProfile(memberId, pin));
  // Adopt a token minted server-side (e.g. after Google OAuth redirect).
  const adoptToken = async (token: string) => {
    localStorage.setItem('hh_token', token);
    const full = await api.me();
    persist(full);
  };
  const startDemo = async () => {
    await finishAuth(await api.demo());
    // Flag a fresh tour so the guided walkthrough kicks off on the dashboard.
    localStorage.setItem('hh_tour', 'pending');
    localStorage.setItem('hh_is_demo', 'true');
  };
  const refresh = async () => { const u = await api.me().catch(() => null); if (u) persist(u); };

  const logout = async () => {
    await api.logout().catch(() => {});
    disconnectLive();
    localStorage.removeItem('hh_token');
    localStorage.removeItem('hh_is_demo');
    localStorage.removeItem('hh_tour');
    persist(null);
  };

  const isAtLeast = (role: Role) => !!user && (ROLE_LEVELS[user.role] ?? 0) >= (ROLE_LEVELS[role] ?? 99);
  const isParent = !!user && (user.role === 'owner' || user.role === 'parent');

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, join, startDemo, switchProfile, adoptToken, logout, refresh, isAtLeast, isParent }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
