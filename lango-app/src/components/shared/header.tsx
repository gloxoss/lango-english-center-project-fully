'use client';

import {
  Bell,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Server,
  Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CndpStatusBadge } from '@/features/settings/ui/cndp-status-badge';
import { authClient } from '@/libs/auth-client';
import { HeaderCampusSwitcher } from './header-campus-switcher';
import { HeaderTenantSwitcher } from './header-tenant-switcher';
import { ImpersonationBanner } from './impersonation-banner';
import { LocaleSwitcher } from './locale-switcher';
import { useSidebarDrawer } from './sidebar-drawer-context';

type SearchResult = { id: string; name: string; email?: string; matricule?: string | null; className?: string | null; total?: number };
type SearchResponse = { students: SearchResult[]; teachers: SearchResult[]; invoices: { id: string; invoiceNumber: string }[] };

type NotificationItem = { id: string; title: string; detail: string; createdAt: string | null; href: string; read: boolean };
type NotificationGroups = { action: NotificationItem[]; updates: NotificationItem[]; system: NotificationItem[] };
type NotificationsResponse = { groups: NotificationGroups; unreadCount: number };

// Roles GET /api/settings/branches serves; keep in step with that route.
const CAMPUS_SWITCHER_ROLES = new Set(['school_admin', 'super_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian']);

export function Header({ locale }: { locale: string }) {
  const router = useRouter();
  const tCommon = useTranslations('Common');
  const tAuth = useTranslations('Auth');
  const tRoles = useTranslations('Roles');
  const tSearch = useTranslations('GlobalSearch');
  const tNotif = useTranslations('NotificationCenter');
  const tProfile = useTranslations('ProfileMenu');
  const { available: drawerAvailable, open: drawerOpen, setOpen: setDrawerOpen } = useSidebarDrawer();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      const branch = typeof window !== 'undefined' ? localStorage.getItem('schoolos_active_branch_id') : null;
      const params = new URLSearchParams({ q: term });
      if (branch) {
        params.set('branchId', branch);
      }
      fetch(`/api/portal/search?${params}`)
        .then(res => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success) {
            setSearchResults(resData.data);
          }
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Drop stale search results after a role switch (role-scoped results must
  // never leak across an active-role change).
  useEffect(() => {
    const clearOnRoleChange = () => {
      setSearchResults(null);
      setSearchTerm('');
    };
    window.addEventListener('portal:role-changed', clearOnRoleChange);
    return () => window.removeEventListener('portal:role-changed', clearOnRoleChange);
  }, []);

  // General notification center: aggregated real sources (action items,
  // updates, system signals). Replaces the announcements-only bell.
  const loadNotifications = () => {
    fetch('/api/dashboard/notifications')
      .then(res => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.success) {
          setNotifications(resData.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!session?.user) {
      return;
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [session?.user]);

  const markAnnouncementsRead = async () => {
    await fetch('/api/communication/announcements/mark-read', { method: 'POST' }).catch(() => {});
    loadNotifications();
  };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userName = isMounted
    ? (session?.user?.name || (sessionPending ? 'Chargement…' : 'Session indisponible'))
    : '…';
  const userEmail = isMounted ? (session?.user?.email || '') : '';
  const userRole = isMounted ? ((session?.user as any)?.role || '') : '';

  // Active-role badge from the server-owned context (shows the effective role,
  // not just the session base role). Falls back to the session role until the
  // request resolves.
  const [portalMe, setPortalMe] = useState<{ role: string; tenantId?: string | null } | null>(null);
  const loadPortalMe = () => {
    fetch('/api/portal/me')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setPortalMe(json.data);
        }
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadPortalMe();
    window.addEventListener('portal:role-changed', loadPortalMe);
    return () => window.removeEventListener('portal:role-changed', loadPortalMe);
  }, []);
  const displayRole = portalMe?.role ?? userRole;
  const hasSelectedTenant = Boolean(portalMe?.tenantId);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  const notifGroups: Array<{ key: keyof NotificationGroups; label: string; icon: React.ReactNode }> = [
    { key: 'action', label: tNotif('groupAction'), icon: (
      <ClipboardList className="size-3.5 text-rose-500" />
    ) },
    { key: 'updates', label: tNotif('groupUpdates'), icon: (
      <Megaphone className="size-3.5 text-blue-500" />
    ) },
    { key: 'system', label: tNotif('groupSystem'), icon: (
      <Server className="size-3.5 text-slate-500" />
    ) },
  ];
  const unreadCount = notifications?.unreadCount ?? 0;
  const hasAnyNotification = notifGroups.some(g => (notifications?.groups[g.key]?.length ?? 0) > 0);

  const searchSections: Array<{ key: 'students' | 'teachers' | 'invoices'; label: string }> = [
    { key: 'students', label: tSearch('students') },
    { key: 'teachers', label: tSearch('staff') },
    { key: 'invoices', label: tSearch('invoices') },
  ];
  const hasAnyResult = searchResults
    && (searchResults.students.length > 0 || searchResults.teachers.length > 0 || searchResults.invoices.length > 0);

  return (
    <div className="sticky top-0 z-40">
      {/* Super-admin impersonation notice — always visible while inside a school (audit 2026-09-22, P1-2) */}
      <ImpersonationBanner locale={locale} />
      <header className="
        flex h-16 items-center justify-between gap-3 border-b
        border-slate-200/90 bg-white px-4 shadow-2xs
        lg:px-6
      "
      >
        {drawerAvailable && (
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Ouvrir le menu"
            aria-expanded={drawerOpen}
            className="
              -ml-1 shrink-0 cursor-pointer rounded-xl p-2 text-slate-500
              transition-colors
              hover:bg-sos-canvas hover:text-[#16212B]
              focus:outline-none
              lg:hidden
            "
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Global Search (school staff or super admin with selected school) */}
        {(displayRole !== 'super_admin' || hasSelectedTenant) && (
          <div className="
            relative hidden w-96 items-center gap-3
            lg:flex
          "
          >
            <div className="relative flex w-full items-center">
              <Search className="
                pointer-events-none absolute top-1/2 left-3 size-4
                -translate-y-1/2 text-slate-400
              "
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(setSearchOpen, 180, false)}
                placeholder={tCommon('search')}
                className="
                  w-full rounded-xl border border-slate-200 bg-sos-canvas/50
                  py-2 pr-4 pl-9 text-xs text-[#16212B] placeholder-slate-400
                  shadow-2xs transition-all
                  focus:border-[#2487B8] focus:bg-white focus:outline-none
                "
              />
            </div>

            {searchOpen && searchTerm.trim().length >= 2 && searchResults && (
              <div className="
                absolute top-full left-0 z-50 mt-1 max-h-96 w-104
                overflow-y-auto rounded-xl border border-slate-200 bg-white
                shadow-xl
              "
              >
                {!hasAnyResult
                  ? (
                      <div className="
                        p-4 text-center text-xs font-medium text-slate-500
                      "
                      >
                        {tSearch('noResults', { query: searchTerm.trim() })}
                      </div>
                    )
                  : (
                      <>
                        {searchSections.map((section) => {
                          const items = (searchResults as any)[section.key] as SearchResult[];
                          if (!items || items.length === 0) {
                            return null;
                          }
                          return (
                            <div
                              key={section.key}
                              className="
                                border-b border-slate-100
                                last:border-b-0
                              "
                            >
                              <p className="
                                px-3 pt-2.5 pb-1 text-[10px] font-extrabold
                                tracking-wider text-slate-400 uppercase
                              "
                              >
                                {section.label}
                              </p>
                              {section.key === 'invoices'
                                ? (
                                    searchResults.invoices.map(i => (
                                      <Link
                                        key={`i-${i.id}`}
                                        href={`/${locale}/dashboard/finance/invoices?id=${i.id}`}
                                        className="
                                          block px-3 py-2 text-xs
                                          hover:bg-slate-50
                                        "
                                      >
                                        <span className="
                                          font-bold text-[#16212B]
                                        "
                                        >
                                          {i.invoiceNumber}
                                        </span>
                                      </Link>
                                    ))
                                  )
                                : (
                                    items.map(s => (
                                      <Link
                                        key={`${section.key}-${s.id}`}
                                        href={`/${locale}/dashboard/${section.key === 'students' ? 'students' : 'teachers/manage'}?id=${s.id}`}
                                        className="
                                          block px-3 py-2
                                          hover:bg-slate-50
                                        "
                                      >
                                        <span className="
                                          text-xs font-bold text-[#16212B]
                                        "
                                        >
                                          {s.name}
                                        </span>
                                        <span className="
                                          block text-[10px] font-medium
                                          text-slate-400
                                        "
                                        >
                                          {[s.className, s.matricule].filter(Boolean).join(' · ')}
                                        </span>
                                      </Link>
                                    ))
                                  )}
                            </div>
                          );
                        })}
                        {searchResults.students.length > 0 && (
                          <Link
                            href={`/${locale}/dashboard/students?q=${encodeURIComponent(searchTerm.trim())}`}
                            className="
                              block border-t border-slate-100 px-3 py-2.5
                              text-center text-[11px] font-extrabold
                              text-blue-600
                              hover:bg-slate-50
                            "
                          >
                            {tSearch('seeAll')}
                          </Link>
                        )}
                      </>
                    )}
              </div>
            )}
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Super Admin Tenant Scope Switcher */}
          {displayRole === 'super_admin' && (
            <HeaderTenantSwitcher locale={locale} />
          )}

          {/* CNDP filing status, read from the registry. Only asked for by roles
            that may read the filing; everyone else renders nothing and makes no
            request at all. */}
          <div className="
            hidden
            lg:flex
          "
          >
            <CndpStatusBadge enabled={displayRole === 'school_admin' || displayRole === 'super_admin'} />
          </div>

          {/* Campus Switcher (strictly for school staff or super_admin inspecting a tenant) */}
          {/* Same roles as GET /api/settings/branches: families and alumni have no
            campus to switch, and asking would 403 on every page (audit S-44). */}
          {displayRole && CAMPUS_SWITCHER_ROLES.has(displayRole)
            && (displayRole !== 'super_admin' || hasSelectedTenant) && (
            <div className="
              hidden
              lg:flex
            "
            >
              <HeaderCampusSwitcher />
            </div>
          )}

          {/* Notification Center (all school roles; sources are capability-gated) */}
          {displayRole !== 'super_admin' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={tNotif('title')}
                  className="
                    relative cursor-pointer rounded-xl p-2 text-slate-500
                    transition-colors
                    hover:bg-sos-canvas hover:text-[#16212B]
                    focus:outline-none
                  "
                >
                  <Bell className="size-4 text-slate-600" />
                  {unreadCount > 0 && (
                    <span className="
                      absolute top-1 right-1 flex h-4 min-w-4 items-center
                      justify-center rounded-full bg-sos-danger px-1 text-[9px]
                      font-extrabold text-white ring-2 ring-white
                    "
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="
                  w-96 overflow-hidden rounded-2xl border border-slate-200 p-0
                  shadow-xl
                "
              >
                <div className="
                  flex items-center justify-between border-b border-slate-100
                  bg-sos-canvas/80 p-3
                "
                >
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-[#2487B8]" />
                    <span className="text-xs font-extrabold text-[#16212B]">{tNotif('title')}</span>
                    {unreadCount > 0 && (
                      <span className="
                        rounded-full bg-sos-danger px-1.5 py-0.5 text-[10px]
                        font-bold text-white
                      "
                      >
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {notifications && (notifications.groups.updates.length > 0) && (
                    <button
                      onClick={markAnnouncementsRead}
                      className="
                        flex items-center gap-1 text-[10px] font-bold
                        text-sos-primary-active
                        hover:underline
                      "
                    >
                      <CheckCheck className="size-3" />
                      {tNotif('markAllRead')}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {!notifications
                    ? (
                        <div className="
                          p-4 text-center text-xs font-medium text-slate-400
                        "
                        >
                          {tCommon('loading')}
                        </div>
                      )
                    : !hasAnyNotification
                        ? (
                            <div className="
                              p-6 text-center text-xs font-medium text-slate-500
                            "
                            >
                              {tNotif('empty')}
                            </div>
                          )
                        : (
                            notifGroups.map((group) => {
                              const items = notifications.groups[group.key];
                              if (items.length === 0) {
                                return null;
                              }
                              return (
                                <div
                                  key={group.key}
                                  className="
                                    border-b border-slate-100
                                    last:border-b-0
                                  "
                                >
                                  <p className="
                                    flex items-center gap-1.5 px-3 pt-2.5 pb-1
                                    text-[10px] font-extrabold tracking-wider
                                    text-slate-400 uppercase
                                  "
                                  >
                                    {group.icon}
                                    {group.label}
                                  </p>
                                  {items.map(item => (
                                    <DropdownMenuItem key={item.id} asChild>
                                      <Link
                                        href={`/${locale}${item.href}`}
                                        className="
                                          flex cursor-pointer flex-col
                                          items-start gap-0.5 p-3
                                          hover:bg-slate-50
                                        "
                                      >
                                        <span className="
                                          flex w-full items-center
                                          justify-between gap-2
                                        "
                                        >
                                          <span className="
                                            text-xs font-bold text-[#16212B]
                                          "
                                          >
                                            {item.title}
                                          </span>
                                          <span className="
                                            size-1.5 shrink-0 rounded-full
                                            bg-sos-danger
                                          "
                                          />
                                        </span>
                                        {item.detail && (
                                          <span className="
                                            text-[10px] font-medium
                                            text-slate-500
                                          "
                                          >
                                            {item.detail}
                                          </span>
                                        )}
                                      </Link>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              );
                            })
                          )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Locale Switcher */}
          <LocaleSwitcher currentLocale={locale} />

          {/* Profile Avatar Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="
                group flex cursor-pointer items-center gap-2.5 border-l
                border-slate-200 pl-3
                focus:outline-none
              "
              >
                <div className="
                  flex size-8 items-center justify-center rounded-full
                  bg-[#2487B8] text-xs font-extrabold text-white shadow-xs
                  transition-all
                  group-hover:ring-2 group-hover:ring-[#2487B8]/30
                "
                >
                  {session?.user ? initials || '?' : '…'}
                </div>
                <div className="
                  hidden text-left
                  lg:block
                "
                >
                  <p className="text-xs/tight font-bold text-[#16212B]">{userName}</p>
                  <p className="text-[10px] font-medium text-slate-500">{userEmail}</p>
                </div>
                <ChevronDown className="
                  size-3.5 text-slate-400 transition-transform
                  group-hover:text-slate-600
                "
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="
                w-64 rounded-2xl border border-slate-200/90 bg-white p-2
                shadow-xl
              "
            >
              <div className="
                mb-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5
              "
              >
                <p className="text-xs font-extrabold text-[#16212B]">{userName}</p>
                <p className="text-[10px] font-medium text-slate-500">{userEmail}</p>
                <div className="
                  mt-1.5 inline-flex items-center gap-1 rounded-md
                  bg-sos-primary-soft px-2 py-0.5 text-[10px] font-bold
                  text-sos-primary-active capitalize
                "
                >
                  <span>{displayRole ? ((tRoles as any).has(displayRole) ? tRoles(displayRole) : displayRole.replace('_', ' ')) : '—'}</span>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* No fake "Mon profil" entry: no personal-profile route exists for
                school_admin today (documented in the enhancement report). */}
              <DropdownMenuItem asChild>
                <Link
                  href={`/${locale}/dashboard/settings`}
                  className="
                    flex w-full cursor-pointer items-center gap-2.5 rounded-xl
                    px-3 py-2 text-xs font-semibold
                    hover:bg-slate-50
                  "
                >
                  <Settings className="size-4 text-[#2487B8]" />
                  <span>{tProfile('schoolSettings')}</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleSignOut}
                className="
                  flex w-full cursor-pointer items-center gap-2.5 rounded-xl
                  px-3 py-2 text-xs font-bold text-sos-danger
                  focus:bg-sos-danger-soft/60 focus:text-sos-danger
                "
              >
                <LogOut className="size-4" />
                <span>{tAuth('signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
