// WHY THIS FILE EXISTS
// --------------------
// React Context holding the current user's auth state. Components use the
// useAuth() hook to find out who is logged in, what role they have, and to
// trigger login/register/logout. Keeps that state out of prop-drilling.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { apiClient, TOKEN_KEY } from '../api/client';

export type Role = 'ADMIN' | 'REPORTER';

interface AuthState {
  token: string | null;
  username: string | null;
  role: Role | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const USER_KEY = 'incidentapp.user';
const ROLE_KEY = 'incidentapp.role';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USER_KEY),
    role: (localStorage.getItem(ROLE_KEY) as Role | null) ?? null,
  }));

  // Keep localStorage in sync with state changes so a full page reload restores us.
  useEffect(() => {
    if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
    else localStorage.removeItem(TOKEN_KEY);

    if (state.username) localStorage.setItem(USER_KEY, state.username);
    else localStorage.removeItem(USER_KEY);

    if (state.role) localStorage.setItem(ROLE_KEY, state.role);
    else localStorage.removeItem(ROLE_KEY);
  }, [state]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { username, password });
    setState({ token: data.token, username: data.username, role: data.role as Role });
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/register', { username, password });
    setState({ token: data.token, username: data.username, role: data.role as Role });
  }, []);

  const logout = useCallback(() => {
    setState({ token: null, username: null, role: null });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAuthenticated: !!state.token,
    isAdmin: state.role === 'ADMIN',
    login,
    register,
    logout,
  }), [state, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
