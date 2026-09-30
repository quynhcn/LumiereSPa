'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  customer?: any;
  staff?: any;
}

interface AuthContextValue {
  session: { user: User } | null; // Mock session wrapper for compatibility
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not auth');
        const data = await res.json();
        
        if (mounted) {
          setUser(data.user || null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    void fetchSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = async () => {
    setUser(null);
    setLoading(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider value={{ session, user, role: user?.role || null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getRedirectPath(role: UserRole | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/account';
}

/** Only allow same-origin relative paths (blocks open redirects like ?redirect=//evil.com). */
export function safeRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  return path;
}
