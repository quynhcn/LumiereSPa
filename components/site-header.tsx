'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, CalendarCheck, LayoutDashboard, LogOut, Menu, Scissors, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { LoginDialog } from '@/components/login-dialog';
import { Logo } from '@/components/logo';
import { UserMenu } from '@/components/user-menu';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/about', label: 'Giới thiệu' },
  { href: '/services', label: 'Dịch vụ' },
  { href: '/#uu-dai', label: 'Ưu đãi' },
  { href: '/#lien-he', label: 'Liên hệ' },
];

const sheetLink = 'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold text-foreground hover:bg-muted';

/**
 * Public header (home, booking, account, staff).
 *
 * Layout is identical for guests and signed-in users — only the right slot changes:
 *   guest:     [Đăng nhập]            [Đặt lịch ngay →]
 *   signed in: [(A) Tên ▾] (menu)     [Đặt lịch ngay →]
 * While the session is loading the right slot keeps its size (no jump / flicker).
 */
export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const { session, user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile sheet on navigation, lock page scroll while it is open
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const displayName =
    (user?.user_metadata?.name as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Tài khoản';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push('/');
  };

  const showBookingCta = showCta && pathname !== '/booking';

  const isLinkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href.startsWith('/#')) {
      return false;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--cream-soft))]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[78px] md:h-[82px] max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:gap-6">
        <Logo className="mr-auto shrink-0" />

        <nav className="hidden items-center gap-6 lg:flex xl:gap-8" aria-label="Điều hướng chính">
          {NAV_LINKS.map((l) => {
            const active = isLinkActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'relative whitespace-nowrap text-sm font-semibold transition-all py-1.5',
                  active
                    ? 'text-primary font-bold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[2.5px] after:rounded-full after:bg-primary'
                    : 'text-muted-foreground hover:text-primary'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <span className="hidden h-6 w-px bg-border lg:block" aria-hidden />

        {/* Account slot — fixed min width so the header does not jump after auth resolves */}
        <div className="hidden min-w-[92px] items-center justify-end lg:flex">
          {loading ? (
            <span className="h-10 w-[92px] animate-pulse rounded-full bg-muted" aria-hidden />
          ) : session ? (
            <UserMenu name={displayName} email={user?.email} role={role} onSignOut={handleSignOut} />
          ) : (
            <LoginDialog />
          )}
        </div>

        {showBookingCta && (
          <>
            <Link href="/booking" className="btn-primary hidden h-11 sm:inline-flex">
              Đặt lịch ngay <ArrowRight className="h-4 w-4" />
            </Link>
            {/* Phones: keep the main action visible without opening the menu */}
            <Link href="/booking" className="btn-primary h-9 px-3.5 text-xs sm:hidden">
              Đặt lịch
            </Link>
          </>
        )}

        <button
          className="-mr-2 rounded-md p-2 text-primary lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
    </header>

      {/* Mobile sheet — rendered OUTSIDE <header>: the header's backdrop-blur would otherwise
          become the containing block for this fixed element and squash it to the header height */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[79px] md:top-[83px] z-40 overflow-y-auto bg-[hsl(var(--cream-soft))] px-4 pb-8 pt-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
            {NAV_LINKS.map((l) => {
              const active = isLinkActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-all',
                    active
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span>{l.label}</span>
                  {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>

          <div className="my-4 h-px bg-border" />

          {loading ? null : session ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-3 pb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                  {displayName.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              {role === 'admin' && (
                <Link href="/admin" className={sheetLink}>
                  <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> Trang quản trị
                </Link>
              )}
              {role === 'staff' && (
                <Link href="/staff" className={sheetLink}>
                  <Scissors className="h-5 w-5 text-muted-foreground" /> Lịch làm việc của tôi
                </Link>
              )}
              <Link href="/account" className={sheetLink}>
                <CalendarCheck className="h-5 w-5 text-muted-foreground" /> Lịch hẹn & tài khoản
              </Link>
              <button onClick={handleSignOut} className={cn(sheetLink, 'w-full text-destructive hover:bg-destructive/10')}>
                <LogOut className="h-5 w-5" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="px-3">
              {/* Keep the sheet mounted while the dialog is open (closing it would unmount the dialog) */}
              <LoginDialog mobile className="text-[15px] font-semibold text-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Chưa có tài khoản?{' '}
                <Link href="/signup" className="font-semibold text-primary">
                  Đăng ký
                </Link>
              </p>
            </div>
          )}

          {showBookingCta && (
            <Link href="/booking" onClick={() => setOpen(false)} className="btn-primary mt-6 w-full">
              Đặt lịch ngay <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
