'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'staff' | 'customer';

export const SEED_ACCOUNTS: Record<
  string,
  { id: string; email: string; pass: string; role: UserRole; name: string; staff_id?: string }
> = {
  'admin@lumierespa.vn': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@lumierespa.vn',
    pass: 'Admin@123456',
    role: 'admin',
    name: 'Quản Trị Viên',
  },
  'admin@spaflow.vn': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@spaflow.vn',
    pass: 'Admin@123456',
    role: 'admin',
    name: 'Quản Trị Viên',
  },
  'lan@lumierespa.vn': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'lan@lumierespa.vn',
    pass: 'Staff@123456',
    role: 'staff',
    name: 'Nguyễn Thị Lan',
    staff_id: 'a045c995-e737-449c-a04d-ccb571b87e00',
  },
  'lan@spaflow.vn': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'lan@spaflow.vn',
    pass: 'Staff@123456',
    role: 'staff',
    name: 'Nguyễn Thị Lan',
    staff_id: 'a045c995-e737-449c-a04d-ccb571b87e00',
  },
  'khachhang@lumierespa.vn': {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'khachhang@lumierespa.vn',
    pass: 'Khach@123456',
    role: 'customer',
    name: 'Khách Thân Thiết',
  },
  'khachhang@spaflow.vn': {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'khachhang@spaflow.vn',
    pass: 'Khach@123456',
    role: 'customer',
    name: 'Khách Thân Thiết',
  },
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsSeed: (email: string) => UserRole | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  signInAsSeed: () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const roleUserId = useRef<string | null>(null);

  const signInAsSeed = (targetEmail: string): UserRole | null => {
    const norm = targetEmail.trim().toLowerCase();
    const seed = SEED_ACCOUNTS[norm];
    if (!seed) return null;

    const seedSession: Session = {
      access_token: 'spaflow-seed-token-' + seed.role,
      token_type: 'bearer',
      expires_in: 86400 * 30,
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      refresh_token: 'spaflow-seed-refresh',
      user: {
        id: seed.id,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { name: seed.name },
        aud: 'authenticated',
        confirmation_sent_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        email: seed.email,
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      },
    };

    try {
      localStorage.setItem('spaflow_seed_auth', JSON.stringify({ session: seedSession, role: seed.role }));
    } catch {}

    roleUserId.current = seed.id;
    setSession(seedSession);
    setRole(seed.role);
    setLoading(false);
    return seed.role;
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let authChangeVersion = 0;

    // Check local seed session first
    try {
      const saved = localStorage.getItem('spaflow_seed_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.session && parsed?.role) {
          roleUserId.current = parsed.session.user.id;
          setSession(parsed.session);
          setRole(parsed.role);
          setLoading(false);
          return;
        }
      }
    } catch {}

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

      // Check if it's one of the seed accounts
      for (const s of Object.values(SEED_ACCOUNTS)) {
        if (s.id === nextSession.user.id || s.email === nextSession.user.email) {
          roleUserId.current = s.id;
          setRole(s.role);
          setLoading(false);
          return;
        }
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
    try {
      localStorage.removeItem('spaflow_seed_auth');
    } catch {}
    roleUserId.current = null;
    setSession(null);
    setRole(null);
    setLoading(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut, signInAsSeed }}>
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
  for (const s of Object.values(SEED_ACCOUNTS)) {
    if (s.id === userId || s.email === userId) return s.role;
  }
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data?.role as UserRole) || 'customer';
}
