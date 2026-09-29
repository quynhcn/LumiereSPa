'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'staff' | 'customer';

interface AuthContextValue {
  session: Session | null;
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
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const roleUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let authChangeVersion = 0;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        roleUserId.current = null;
        setRole(null);
        setLoading(false);
        return;
      }
      // TOKEN_REFRESHED etc. for the same user: role is unchanged, skip the query
      if (roleUserId.current === nextSession.user.id) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', nextSession.user.id)
        .maybeSingle();
      if (!mounted) return;
      roleUserId.current = nextSession.user.id;
      setRole((profile?.role as UserRole) || 'customer');
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authChangeVersion += 1;
      void applySession(newSession);
    });

    const initialVersion = authChangeVersion;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (authChangeVersion === initialVersion) void applySession(data.session);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    timeoutId = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    roleUserId.current = null;
    setSession(null);
    setRole(null);
    setLoading(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
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

export async function fetchRole(userId: string): Promise<UserRole> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data?.role as UserRole) || 'customer';
}
