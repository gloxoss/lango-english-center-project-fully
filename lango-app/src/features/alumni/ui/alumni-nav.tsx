'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, LogOut } from 'lucide-react';
import { authClient } from '@/libs/auth-client';

const NAV_ITEMS = [
  { href: '', label: 'Accueil' },
  { href: '/records', label: 'Dossiers' },
  { href: '/events', label: 'Événements' },
  { href: '/directory', label: 'Annuaire' },
  { href: '/mentoring', label: 'Mentorat' },
  { href: '/requests', label: 'Mes demandes' },
  { href: '/profile', label: 'Profil' },
];

// Real, separate nav for the alumni self-service portal - no staff-side
// items (future-implementation/alumni-portal).
export function AlumniNav({ locale, userName }: { locale: string; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${locale}/alumni`;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <header className="bg-white border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0066FF] rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-[#16212B] text-sm hidden sm:inline">Anciens Élèves</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const href = `${base}${item.href}`;
              const active = pathname === href || (item.href === '' && pathname === base);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${active ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'text-slate-500 hover:text-[#16212B]'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-600 hidden md:inline">{userName}</span>
          <button onClick={handleSignOut} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors" title="Déconnexion">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
