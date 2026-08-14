'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { HeaderCampusSwitcher } from './header-campus-switcher';
import {
  Bell,
  Menu,
  Search,
  ShieldCheck,
  User,
  Building2,
  LogOut,
  ChevronDown,
  AlertTriangle,
  CreditCard,
  Lock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/libs/auth-client';
import { useSidebarDrawer } from './sidebar-drawer-context';

type SearchResult = { id: string; name: string; email?: string; matricule?: string | null };
type SearchResponse = { students: SearchResult[]; teachers: SearchResult[]; invoices: { id: string; invoiceNumber: string }[] };

export function Header({ locale }: { locale: string }) {
  const router = useRouter();
  const { available: drawerAvailable, open: drawerOpen, setOpen: setDrawerOpen } = useSidebarDrawer();
  const { data: session } = authClient.useSession();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadList, setUnreadList] = useState<Array<{ id: string; title: string; createdAt: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/portal/search?q=${encodeURIComponent(term)}`)
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

  useEffect(() => {
    if (!session?.user) return;

    const fetchUnreadAnnouncements = () => {
      fetch('/api/communication/announcements/unread-count')
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success) {
            setUnreadCount(resData.count ?? 0);
            setUnreadList(resData.data || []);
          }
        })
        .catch(() => {});
    };

    fetchUnreadAnnouncements();
    const interval = setInterval(fetchUnreadAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [session?.user]);

  const userName = session?.user?.name || 'Utilisateur';
  const userEmail = session?.user?.email || 'user@ecole.ma';
  const userRole = (session?.user as any)?.role || 'school_admin';

  // Active-role badge from the server-owned context (shows the effective role,
  // not just the session base role). Falls back to the session role until the
  // request resolves.
  const [portalMe, setPortalMe] = useState<{ role: string } | null>(null);
  useEffect(() => {
    fetch('/api/portal/me')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setPortalMe(json.data);
      })
      .catch(() => {});
  }, []);
  const displayRole = portalMe?.role ?? userRole;

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

  return (
    <header className="h-16 border-b border-slate-200/90 bg-white px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-40 shadow-2xs">
      {drawerAvailable && (
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          className="lg:hidden shrink-0 p-2 -ml-1 rounded-xl text-slate-500 hover:bg-[#EDF3F8] hover:text-[#16212B] transition-colors focus:outline-none cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Search Input */}
      <div className="hidden lg:flex items-center gap-3 w-80 relative">
        <div className="relative w-full flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Rechercher élèves, enseignants, factures..."
            className="w-full bg-[#EDF3F8]/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-[#16212B] placeholder-slate-400 focus:outline-none focus:border-[#2487B8] focus:bg-white transition-all shadow-2xs"
          />
        </div>

        {searchOpen && searchResults && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
            {searchResults.students.length === 0 && searchResults.teachers.length === 0 && searchResults.invoices.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-medium">Aucun résultat.</div>
            ) : (
              <>
                {searchResults.students.map(s => (
                  <Link key={`s-${s.id}`} href={`/${locale}/dashboard/students?id=${s.id}`} className="block px-3 py-2 hover:bg-slate-50 text-xs">
                    <span className="font-bold text-[#16212B]">{s.name}</span>
                    <span className="text-slate-400 ml-2">Élève</span>
                  </Link>
                ))}
                {searchResults.teachers.map(t => (
                  <Link key={`t-${t.id}`} href={`/${locale}/dashboard/teachers/manage?id=${t.id}`} className="block px-3 py-2 hover:bg-slate-50 text-xs">
                    <span className="font-bold text-[#16212B]">{t.name}</span>
                    <span className="text-slate-400 ml-2">Enseignant</span>
                  </Link>
                ))}
                {searchResults.invoices.map(i => (
                  <Link key={`i-${i.id}`} href={`/${locale}/dashboard/finance/invoices?id=${i.id}`} className="block px-3 py-2 hover:bg-slate-50 text-xs">
                    <span className="font-bold text-[#16212B]">{i.invoiceNumber}</span>
                    <span className="text-slate-400 ml-2">Facture</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Campus Switcher (hidden on small screens — redundant context on a phone) */}
        <div className="hidden lg:flex">
          <HeaderCampusSwitcher />
        </div>

        {/* CNDP Compliance Status Badge per BRAND.md */}
        <div className="hidden md:flex items-center gap-1.5 bg-[#E4EDFD] text-[#2487B8] border border-[#C3DAFB] px-3 py-1 rounded-full text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2487B8]" />
          <span>Conforme CNDP F211</span>
        </div>

        {/* Notifications Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-xl text-slate-500 hover:bg-[#EDF3F8] hover:text-[#16212B] transition-colors focus:outline-none cursor-pointer">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E5544B] ring-2 ring-white"></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0 overflow-hidden rounded-2xl shadow-xl border border-slate-200">
            <div className="p-3 bg-[#EDF3F8]/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#2487B8]" />
                <span className="text-xs font-bold text-[#16212B]">Notifications</span>
              </div>
              <span className="text-[10px] font-bold text-white bg-[#E5544B] px-1.5 py-0.5 rounded-full">
                {unreadCount} {unreadCount > 1 ? 'Annonces' : 'Annonce'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {unreadList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-medium">
                  Aucune nouvelle annonce non lue.
                </div>
              ) : (
                unreadList.map((item) => (
                  <DropdownMenuItem key={item.id} asChild>
                    <Link
                      href={`/${locale}/dashboard/communication/announcements`}
                      className="p-3 flex flex-col items-start gap-1 cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-[#16212B] truncate max-w-[200px]">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Annonce</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Locale Switcher */}
        <LocaleSwitcher currentLocale={locale} />

        {/* Profile Avatar Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-3 border-l border-slate-200 focus:outline-none cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-[#2487B8] text-white flex items-center justify-center text-xs font-extrabold shadow-xs group-hover:ring-2 group-hover:ring-[#2487B8]/30 transition-all">
                {initials || 'US'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-[#16212B] leading-tight">{userName}</p>
                <p className="text-[10px] text-slate-500 font-medium">{userEmail}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-2 rounded-2xl shadow-xl border border-slate-200/90 bg-white">
            <div className="px-3 py-2.5 bg-slate-50 rounded-xl mb-1 border border-slate-100">
              <p className="text-xs font-extrabold text-[#16212B]">{userName}</p>
              <p className="text-[10px] text-slate-500 font-medium">{userEmail}</p>
              <div className="mt-1.5 inline-flex items-center gap-1 bg-[#DCEBF4] text-[#1B6C93] px-2 py-0.5 rounded-md text-[10px] font-bold capitalize">
                <Lock className="w-3 h-3" />
                <span>{displayRole.replace('_', ' ')}</span>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href={`/${locale}/dashboard/settings`} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                <User className="w-4 h-4 text-[#2487B8]" />
                <span>Profil & Paramètres</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#E5544B] focus:text-[#E5544B] focus:bg-[#FCE4E2]/60 cursor-pointer">
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
